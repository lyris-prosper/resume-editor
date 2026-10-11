import { grams } from '../match'
import { stripTodos } from '../facts'
import type { Insight, JobFocus, MetricHint, RewriteInput, RewriteOutput } from './types'

/**
 * 本地规则版的重写：只做去口语、补回事实里已有但原句漏写的内容、按岗位调整顺序和概括短语。
 * 不新增任何事实和数字。接入真实模型后由模型完成，但同样要经过 guard() 校验。
 */

const NUM = /\d+(?:\.\d+)?\s*%?/g

const POLISH: [RegExp, string][] = [
  [/对(.{2,10}?)进行了?([一-鿿]{2})/g, '$2$1'],
  [/进行了?(?=[一-鿿]{2})/g, ''],
  [/帮忙|帮着/g, '协助'],
  [/做了一些|做了/g, '完成'],
  [/(弄|搞)(好|完|定)了?/g, '完成'],
  [/写了/g, '撰写'],
  [/主要是|基本上|其实|一些|一点儿?/g, ''],
  [/然后|接着/g, ''],
  [/，并且/g, '，并'],
  [/通过使用|利用/g, '使用'],
  [/的工作(?=[，。；]|$)/g, ''],
  [/，，+/g, '，'],
]

/** 能力词典：用来说明“这件事体现了什么”，只引用原文里出现的词 */
const ABILITIES: { label: string; re: RegExp }[] = [
  { label: '用户研究', re: /访谈|问卷|调研|用户反馈|可用性测试|用户研究/ },
  { label: '数据分析', re: /数据|Excel|SQL|Python|统计|清洗|看板|图表|趋势|指标|报表/i },
  { label: '需求分析', re: /需求|PRD|用户场景|验收|痛点|功能/i },
  { label: '信息归纳', re: /归纳|归类|梳理|总结|提炼|摘录/ },
  { label: '原型设计', re: /原型|Figma|墨刀|Axure|交互|界面|页面/i },
  { label: '跨团队协作', re: /评审|沟通|协作|对接|协调|跨团队|跟进/ },
  { label: '内容策划', re: /推文|选题|文案|公众号|写作|撰写|排版|内容/ },
  { label: '活动运营', re: /活动|报名|签到|社群|拉新|留存|转化/ },
  { label: '项目推进', re: /排期|统筹|组织|推进|里程碑|上线|交付/ },
  { label: '工程实现', re: /开发|代码|接口|部署|系统|架构|前端|后端|服务|框架/ },
  { label: '算法与建模', re: /算法|模型|训练|推理|特征|机器学习|深度学习|神经网络/ },
  { label: '科研能力', re: /实验|论文|文献|课题|复现|数据集|研究/ },
]

/** 岗位侧的说法：岗位描述和经历都提到同一组词时，概括短语改用岗位里的说法 */
const TAILOR_GROUPS: { label: string; words: string[] }[] = [
  { label: '用户研究', words: ['用户研究', '用户调研', '访谈', '问卷', '调研', '洞察', '用户反馈'] },
  { label: '数据分析', words: ['数据分析', '数据看板', '数据', 'excel', 'sql', '图表', '统计', '指标', '报表'] },
  { label: '需求分析', words: ['需求文档', '需求分析', '需求', 'prd', '场景', '验收'] },
  { label: '原型设计', words: ['原型', 'figma', 'axure', '墨刀', '交互'] },
  { label: '跨团队协作', words: ['跨团队', '沟通', '协作', '评审', '协调', '推进'] },
  { label: '内容运营', words: ['内容', '公众号', '推文', '写作', '选题', '文案'] },
  { label: '活动运营', words: ['活动', '运营', '社群', '增长', '转化'] },
  { label: '工程开发', words: ['开发', '后端', '前端', '接口', '服务', '系统', '架构'] },
  { label: '算法', words: ['算法', '模型', '训练', '推理', '机器学习'] },
]

const clauses = (s: string) =>
  s
    .split(/[，,；;。！!]/)
    .map((x) => x.trim())
    .filter(Boolean)

function bigrams(s: string) {
  const t = s.replace(/[^一-鿿A-Za-z0-9]/g, '')
  const out = new Set<string>()
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2))
  return out
}

/** 一句事实是否已经写进了表达：相同的词够多，或者换了说法但关键字都在（“设计并发放问卷” ≈ “设计问卷”） */
function covered(clause: string, text: string) {
  const c = bigrams(clause)
  if (c.size === 0) return true
  const t = bigrams(text)
  let hit = 0
  for (const g of c) if (t.has(g)) hit++
  if (hit / c.size >= 0.5) return true
  const chars = [...clause.replace(/[^一-鿿A-Za-z0-9]/g, '')].filter((ch) => !'并了的和与及等对将把'.includes(ch))
  const charHit = chars.filter((ch) => text.includes(ch)).length / Math.max(chars.length, 1)
  return charHit >= 0.6 && hit >= 2
}

const terminal = (s: string) => s.replace(/[，,；;。\s]+$/, '')

/** 按标点切开，保留每段末尾的标点，方便重排 */
function pieces(text: string) {
  return terminal(text)
    .split(/(?<=[，；])/)
    .filter((p) => p.replace(/[，；]/g, '').trim())
}

function joinPieces(ps: string[]) {
  const body = ps.map((p, i) => (i === ps.length - 1 ? terminal(p) : /[，；]$/.test(p) ? p : `${p}，`)).join('')
  return body ? `${body}。` : ''
}

const short = (s: string, n = 16) => (s.length > n ? `${s.slice(0, n)}…` : s)

/** 这件事体现了什么能力：标签 + 原文里的依据 */
export function mineInsights(text: string, extra: string[] = [], signals: string[] = []): Insight[] {
  const pool = [text, ...extra].filter(Boolean).join('，')
  const all = clauses(pool)
  const found: (Insight & { score: number })[] = []
  for (const a of ABILITIES) {
    const clause = all.find((c) => a.re.test(c))
    if (!clause) continue
    const score = (signals.some((s) => s.includes(a.label) || a.label.includes(s)) ? 2 : 0) + (a.re.test(text) ? 1 : 0)
    found.push({ label: a.label, evidence: short(clause), score })
  }
  return found
    .sort((x, y) => y.score - x.score)
    .slice(0, 3)
    .map(({ label, evidence }) => ({ label, evidence }))
}

function relevance(clause: string, jobGrams: Set<string>) {
  let n = 0
  for (const g of grams(clause)) if (jobGrams.has(g)) n++
  return n
}

/** 数字只能来自原文和事实：返回改写里出现、但来源里没有的数字 */
export function guard(output: string, sources: string[]) {
  const known = new Set(sources.join(' ').match(NUM)?.map((n) => n.replace(/\s/g, '')) ?? [])
  const extra = (stripTodos(output).match(NUM) ?? []).map((n) => n.replace(/\s/g, '')).filter((n) => !known.has(n))
  return extra
}

/** 夸大角色的说法：来源里没有时，改回中性的写法 */
const INFLATE: [RegExp, string][] = [
  [/独立(?=完成|负责|设计|开发|实现|交付|撰写|搭建|承担)/g, ''],
  [/主导|牵头|带领/g, '参与'],
]

/** 来源里没写“独立”“主导”这类词时，改写也不能写；返回修正后的文字和被改掉的词 */
export function deflate(text: string, sources: string[]) {
  const pool = sources.join(' ')
  const removed: string[] = []
  let out = text
  for (const [re, to] of INFLATE) {
    out = out.replace(re, (m) => {
      // “未独立决定方案”不算；个人项目本来就是独立完成的
      const said = new RegExp(`(?<![未不非没])${m}`).test(pool)
      if (said || (m === '独立' && /个人项目/.test(pool))) return m
      removed.push(m)
      return to
    })
  }
  return { text: out, removed: [...new Set(removed)] }
}

const QUANTITY = /\s*\d+(?:\.\d+)?\s*(?:%|[个位份篇次场人万千小时分钟天周项条页家倍年月元]+)?/g

/**
 * 把来源里没有的数字换成【补充：…】占位，交给用户填真实数字。
 * 模型偶尔会“顺手”写出一个数字，这里兜底，保证不会凭空出现。
 */
export function scrubNumbers(text: string, sources: string[]) {
  const known = new Set(sources.join(' ').match(NUM)?.map((n) => n.replace(/\s/g, '')) ?? [])
  const removed: string[] = []
  const parts = text.split(/(【补充：[^】]*】)/)
  const out = parts
    .map((part) =>
      part.startsWith('【补充：')
        ? part
        : part.replace(QUANTITY, (m, offset: number, whole: string) => {
            const n = m.match(NUM)?.[0]?.replace(/\s/g, '') ?? ''
            if (!n || known.has(n)) return m
            removed.push(m.trim())
            // 用前后的词说明要补什么：“效率提升 30%”→ 效率提升幅度，“覆盖 5 个学院”→ 学院数量
            const before = whole.slice(Math.max(0, offset - 6), offset).match(/[\u4e00-\u9fff]{2,4}$/)?.[0] ?? ''
            const after = whole.slice(offset + m.length).match(/^[\u4e00-\u9fff]{2}/)?.[0] ?? ''
            if (m.includes('%')) return `【补充：${before ? `${before.replace(/^(将|使|把)/, '')}幅度` : '比例'}】`
            return `【补充：${after ? `${after}数量` : before ? `${before}数量` : '数量'}】`
          }),
    )
    .join('')
  return { text: out, removed }
}

function tailor(text: string, lead: string, job: JobFocus, notes: string[], inserted: { clause: string; note: string } | null) {
  const jobText = [job.title, ...job.requirements, ...job.keywords].join(' ').toLowerCase()
  const jobGrams = grams(jobText)
  let ps = pieces(text)

  // 删去和岗位关系最弱、又不含数字的一句（只删不加）
  if (ps.length >= 3) {
    const scored = ps.map((p, i) => ({ i, r: relevance(p, jobGrams), num: /\d/.test(p) }))
    const weak = scored.filter((s) => s.i > 0 && s.i < ps.length - 1 && s.r === 0 && !s.num)[0]
    if (weak) {
      const piece = terminal(ps[weak.i])
      // 刚从事实里补回来的句子和岗位无关：不补就是了，不要先加后删
      if (inserted && piece === inserted.clause) notes.splice(notes.indexOf(inserted.note), 1)
      else notes.push(`删去和「${job.title || '这个岗位'}」关系较弱的「${short(piece, 12)}」`)
      ps = ps.filter((_, i) => i !== weak.i)
    }
  }
  // 把最相关的一句放到最前面
  if (ps.length >= 2) {
    const scores = ps.map((p) => relevance(p, jobGrams))
    const best = scores.indexOf(Math.max(...scores))
    if (best > 0 && best < ps.length - 1 && scores[best] > scores[0]) {
      notes.push(`把岗位最看重的「${short(terminal(ps[best]), 12)}」放到句首`)
      const moved = ps[best].replace(/[，；]?$/, '，')
      ps = [moved, ...ps.filter((_, i) => i !== best)]
    }
  }
  let nextLead = lead
  const lower = text.toLowerCase()
  const group = TAILOR_GROUPS.find((g) => g.words.some((w) => jobText.includes(w)) && g.words.some((w) => lower.includes(w)))
  if (group && !group.words.some((w) => lead.toLowerCase().includes(w)) && !lead.includes(group.label)) {
    nextLead = group.label
    notes.push(`概括短语改用岗位里的说法「${group.label}」`)
  }
  return { text: joinPieces(ps), lead: nextLead }
}

export function rewriteLocally(input: RewriteInput): RewriteOutput {
  const facts = input.facts
  const notes: string[] = []
  const asks: string[] = []
  const original = input.text.trim() || [facts?.action, facts?.result].filter(Boolean).map((s) => terminal(s!)).join('，')
  let text = original

  // 1. 去口语、去冗词
  const before = text
  for (const [re, to] of POLISH) text = text.replace(re, to)
  if (text !== before) notes.push('去掉口语和冗余的词，动词放在前面')

  // 2. 补回事实里记录了、但原句漏写的亮点
  let inserted: { clause: string; note: string } | null = null
  if (facts) {
    const actionMissing = clauses(facts.action).filter((c) => c.length >= 4 && !covered(c, text))[0]
    if (actionMissing) {
      const ps = pieces(text)
      ps.splice(Math.min(1, ps.length), 0, `${actionMissing}，`)
      text = joinPieces(ps)
      inserted = { clause: actionMissing, note: `补上事实里有、原句没写的「${short(actionMissing, 12)}」` }
      notes.push(inserted.note)
    }
    const resultMissing = clauses(facts.result).filter((c) => c.length >= 3 && !covered(c, text))[0]
    if (resultMissing) {
      text = `${terminal(text)}，${resultMissing}。`
      notes.push(`把结果「${short(resultMissing, 12)}」写进句末`)
    }
    // 3. 贡献边界：本人只是协助时，不写成主导
    if (/协助|参与|共同|配合|未独立/.test(facts.contribution) && /主导|牵头|独立/.test(text)) {
      text = text.replace(/主导|牵头/g, '参与').replace(/独立(?=完成|负责)/g, '')
      notes.push('按你记录的贡献边界，把「主导」「独立」改得更准确')
    }
    if (!facts.result) asks.push('这件事最后带来了什么结果？')
    if (!facts.metrics.length && !/\d/.test(text)) asks.push('有没有可以引用的数字，比如人数、份数、次数？')
    if (!facts.contribution) asks.push('哪些部分是你本人完成的？')
  }

  let lead = input.lead.trim()
  if (input.job) {
    const t = tailor(text, lead || facts?.title || '', input.job, notes, inserted)
    text = t.text
    lead = t.lead
  }
  if (!lead && facts?.title) {
    lead = facts.title
    notes.push('补上概括短语，方便招聘方快速扫读')
  }
  text = text ? `${terminal(text)}。` : text

  // 4. 校验：数字只能来自原文和事实
  const sources = [original, input.lead, facts?.action ?? '', facts?.result ?? '', facts?.background ?? '', ...(facts?.metrics ?? [])]
  if (guard(`${lead} ${text}`, sources).length) {
    return { lead: input.lead, text: input.text, insights: [], metrics: [], notes: ['改写里出现了事实中没有的数字，已退回原文'], asks, engine: '本地规则' }
  }
  if (text === input.text.trim() && lead === input.lead.trim()) notes.push('这条表达已经比较完整，没有需要改的地方')

  return {
    lead,
    text,
    insights: mineInsights(text, [facts?.action ?? '', facts?.result ?? ''], facts?.signals),
    metrics: metricHints(text, facts?.metrics ?? []),
    notes,
    asks: asks.slice(0, 2),
    engine: '本地规则',
  }
}

/** 用上了哪些数字；一个数字都没有时，提示可以量化的方向 */
function metricHints(text: string, metrics: string[]): MetricHint[] {
  const used = metrics
    .filter((m) => (m.match(NUM) ?? []).some((n) => text.includes(n.trim())))
    .map((m) => ({ label: m.replace(NUM, '').trim() || '数字', value: m, status: 'used' as const, question: '' }))
  if (used.length || /\d/.test(text)) return used
  return [{ label: '规模', value: '', status: 'missing', question: '这件事涉及多少人、多少份数据或多少次？有大概的数字吗？' }]
}

/** 岗位描述里的关键词，交给重写和匹配使用 */
export function jobKeywords(raw: string) {
  const lower = raw.toLowerCase()
  return [...new Set(TAILOR_GROUPS.flatMap((g) => g.words.filter((w) => lower.includes(w))))]
}
