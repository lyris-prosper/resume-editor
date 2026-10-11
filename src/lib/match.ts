import type { Event, Experience, Library, Requirement } from './schema'

export type MatchLevel = 'direct' | 'partial' | 'none'

export interface Candidate {
  event: Event
  experience: Experience
  score: number
  level: MatchLevel
  /** 命中的词，用来向用户解释“为什么选这条” */
  hits: string[]
}

export interface RequirementMatch {
  requirement: Requirement
  level: MatchLevel
  candidates: Candidate[]
}

/** 小型同义词组：本地启发式匹配用，接入模型后由模型解释相关性 */
const SYNONYMS: string[][] = [
  ['数据分析', '数据', '分析', 'excel', '图表', '清洗', '统计', 'sql', '指标', '趋势'],
  ['用户研究', '用户', '访谈', '问卷', '调研', '洞察', '反馈', '可用性'],
  ['原型', 'figma', 'axure', '墨刀', '交互', '设计'],
  ['沟通', '协作', '跨团队', '评审', '协调', '推进', '对接'],
  ['需求', '需求文档', 'prd', '文档', '场景', '验收'],
  ['内容', '推文', '写作', '公众号', '新媒体', '文案', '策划'],
  ['运营', '活动', '增长', '社群', '拉新', '留存', '转化'],
]

export function grams(text: string) {
  const lower = text.toLowerCase()
  const out = new Set<string>()
  for (const w of lower.match(/[a-z][a-z0-9+#.]*/g) ?? []) out.add(w)
  const cjk = lower.replace(/[^一-鿿]+/g, ' ').split(' ')
  for (const run of cjk) for (let i = 0; i < run.length - 1; i++) out.add(run.slice(i, i + 2))
  return out
}

function expand(text: string) {
  const lower = text.toLowerCase()
  const extra = SYNONYMS.filter((g) => g.some((w) => lower.includes(w))).flat()
  return { base: grams(text), extra: new Set(extra.flatMap((w) => [...grams(w)])) }
}

const STOP = new Set(['负责', '相关', '能力', '具备', '熟悉', '良好', '以上', '优先', '经验', '工作', '进行', '能够', '一定', '了解', '使用'])

function scoreEvent(req: Requirement, ev: Event) {
  const { base, extra } = expand(req.text)
  const evText = [ev.title, ev.action, ev.result, ev.signals.join(' '), ...ev.variants.map((v) => v.text)].join(' ')
  const evGrams = grams(evText)
  const signalGrams = grams(ev.signals.join(' '))
  const hits: string[] = []
  let score = 0
  let total = 0
  for (const g of base) {
    if (STOP.has(g)) continue
    total += 1
    if (evGrams.has(g)) {
      score += signalGrams.has(g) ? 1.5 : 1
      hits.push(g)
    }
  }
  for (const g of extra) {
    if (base.has(g) || STOP.has(g)) continue
    if (evGrams.has(g)) {
      score += 0.5
      hits.push(g)
    }
  }
  // 给用户看的命中词：用完整词而不是二字切片
  const reqLower = req.text.toLowerCase()
  const evLower = evText.toLowerCase()
  const vocab = [...SYNONYMS.filter((g) => g.some((w) => reqLower.includes(w))).flat(), ...ev.signals.map((x) => x.toLowerCase())]
  const words = [...new Set(vocab)].filter((w) => w.length >= 2 && evLower.includes(w) && !STOP.has(w))
  const readable = words.filter((w) => !words.some((o) => o !== w && o.includes(w)))
  return { score: total ? score / Math.max(total, 3) : 0, hits: (readable.length ? readable : hits).slice(0, 5) }
}

function level(score: number): MatchLevel {
  if (score >= 0.45) return 'direct'
  if (score >= 0.18) return 'partial'
  return 'none'
}

/** 要求 ↔ 事件 ↔ 证据 */
export function matchRequirements(library: Library, requirements: Requirement[]): RequirementMatch[] {
  const events = library.events
  return requirements.map((requirement) => {
    // 学历、到岗时间等门槛不靠经历证明，交给用户自己核对
    if (requirement.kind === 'hard') return { requirement, level: 'none' as const, candidates: [] }
    const candidates = events
      .map((event) => {
        const experience = library.experiences.find((x) => x.id === event.experienceId)!
        const { score, hits } = scoreEvent(requirement, event)
        return { event, experience, score, hits, level: level(score) }
      })
      .filter((c) => c.experience && c.level !== 'none')
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
    return { requirement, level: candidates[0]?.level ?? 'none', candidates }
  })
}

/** 根据要求匹配结果推荐选材：每个事件挑一个与岗位最相关的表达 */
export function recommendPicks(matches: RequirementMatch[], jobText: string) {
  const scores = new Map<string, { event: Event; score: number }>()
  for (const m of matches) {
    const weight = m.requirement.kind === 'bonus' ? 0.6 : 1
    for (const c of m.candidates) {
      const prev = scores.get(c.event.id)
      scores.set(c.event.id, { event: c.event, score: (prev?.score ?? 0) + c.score * weight })
    }
  }
  const job = grams(jobText)
  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .map(({ event }) => {
      const best = event.variants
        .map((v) => ({ v, s: [...grams(v.angle + v.text)].filter((g) => job.has(g)).length }))
        .sort((a, b) => b.s - a.s)[0]?.v
      return { eventId: event.id, variantId: best?.id }
    })
}
