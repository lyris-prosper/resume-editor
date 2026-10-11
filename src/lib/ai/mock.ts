import type { AiProvider, ChatDraft, ChatEventDraft, InterviewDraft, InterviewInput, InterviewOutput, InterviewSlot, ParsedEntry, ParsedJob, ParsedResume } from './types'
import type { EmploymentType, ExperienceKind, RequirementKind } from '../schema'
import { matchRequirements } from '../match'
import { classifyEntry, headingHint, type SectionHint } from '../classify'
import { normDate } from '../format'
import { uid } from '../ids'
import { rewriteLocally } from './rewrite'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

const stripBullet = (line: string) =>
  line
    .replace(/^\s*(?:[-*•·●▪]|\d+[.、)）]|[（(]\d+[)）]|[一二三四五六七八九十]+[、.])\s*/, '')
    .replace(/[；;。]$/, '')
    .trim()

/* ---------- 岗位识别 ---------- */

const HARD = /(本科|硕士|博士|学历|专业|年级|届|每周|周[一二三四五]|天\/周|实习期|至少|以上|必须|到岗|英语|CET|证书)/i

export function parseJobText(raw: string): ParsedJob {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const grab = (re: RegExp) => {
    for (const l of lines) {
      const m = l.match(re)
      if (m?.[1]) return m[1].trim()
    }
    return ''
  }

  let company = grab(/^(?:公司(?:名称)?|企业)[:：]\s*(.+)$/)
  if (!company) company = lines.find((l) => /(有限公司|集团|科技|网络|股份)$/.test(l) && l.length <= 24) ?? ''
  let title = grab(/^(?:岗位|职位|岗位名称|职位名称|招聘岗位)[:：]\s*(.+)$/)
  if (!title)
    title =
      lines.find((l) => l.length <= 24 && /(实习生|工程师|经理|专员|运营|产品|设计师|分析师|助理|研究员)/.test(l) && !/[:：]/.test(l)) ??
      ''
  const location = grab(/^(?:工作)?(?:地点|城市|base|Base|BASE)[:：]?\s*(.+)$/)

  const responsibilities: string[] = []
  const requirements: ParsedJob['requirements'] = []
  let mode: 'resp' | 'req' | 'bonus' | null = null

  for (const line of lines) {
    const header = line.replace(/[:：]$/, '')
    if (/^(?:岗位|工作)?(?:职责|内容|描述)|你将|你需要做/.test(header) && line.length <= 16) {
      mode = 'resp'
      continue
    }
    if (/^(?:任职|岗位|职位)?(?:要求|资格)|我们希望|你需要具备/.test(header) && line.length <= 16) {
      mode = 'req'
      continue
    }
    if (/^(?:加分项?|优先(?:条件)?|加分)/.test(header) && line.length <= 16) {
      mode = 'bonus'
      continue
    }
    const text = stripBullet(line)
    if (!text || text === company || text === title) continue
    if (mode === 'resp') {
      responsibilities.push(text)
      requirements.push({ kind: 'duty', text })
    }
    else if (mode === 'req' || mode === 'bonus') {
      const kind: RequirementKind = mode === 'bonus' || /优先|加分/.test(text) ? 'bonus' : HARD.test(text) ? 'hard' : 'core'
      requirements.push({ kind, text })
    }
  }

  // 没有明确分节时，把带编号的行都当作要求，交给用户修改
  if (responsibilities.length === 0 && requirements.length === 0) {
    for (const line of lines) {
      if (/^\s*(?:[-*•·●]|\d+[.、)）])/.test(line)) {
        const text = stripBullet(line)
        requirements.push({ kind: /优先|加分/.test(text) ? 'bonus' : HARD.test(text) ? 'hard' : 'core', text })
      }
    }
  }

  return { company, title, location, responsibilities, requirements }
}

/* ---------- 经历访谈 ---------- */

const QUESTIONS: Record<InterviewSlot, (d: InterviewDraft) => string> = {
  org: () => '先说说这段经历在哪里：公司、实验室、社团，或者项目名称是什么？',
  role: (d) => `在「${d.org}」里你的角色是什么？比如产品实习生、科研助理、课程项目负责人。`,
  time: () => '大概是什么时候开始、什么时候结束？没结束可以说“至今”。',
  title: () => '这段经历里，你最想讲的一件具体的事是什么？一个短语就行，比如“用户访谈整理”。',
  background: (d) => `做「${d.title}」之前，遇到了什么情况或问题？`,
  action: () => '你具体做了哪些动作？尽量说你本人做的，而不是团队整体。',
  contribution: () => '哪些部分是你独立完成的，哪些是和别人一起做的？说清楚边界，简历才不会写过头。',
  result: () => '最后产出了什么，或者带来了什么变化？没有明确结果也可以说“没有”。',
  metrics: () => '有没有可以引用的数字，比如人数、份数、次数、时长？没有就回复“跳过”。',
}

const ORDER: InterviewSlot[] = ['org', 'role', 'time', 'title', 'background', 'action', 'contribution', 'result', 'metrics']

const SKIP = /^(跳过|没有|无|不知道|没|算了|skip)$/i

/** 访谈里判断栏目：机构 + 角色；没有线索时按实习处理（面向在校生） */
export function detectType(text: string): { type: EmploymentType; kind: ExperienceKind } {
  const c = classifyEntry(text, null, text)
  if (c.category === 'education' || c.reason.startsWith('没有明确线索')) return { type: 'internship', kind: 'internship' }
  if (c.category === 'work' && /有限公司|集团|科技|公司/.test(text) && !/全职|正式/.test(text)) return { type: 'internship', kind: 'internship' }
  return { type: c.type, kind: c.category }
}

export function nextInterviewSlot(d: InterviewDraft): InterviewSlot | null {
  for (const slot of ORDER) {
    if (d.skipped.includes(slot)) continue
    const filled = slot === 'time' ? Boolean(d.start && d.end) : slot === 'metrics' ? d.metrics.length > 0 : Boolean(d[slot])
    if (!filled) return slot
  }
  return null
}

export function emptyDraft(): InterviewDraft {
  return {
    org: '',
    role: '',
    employmentType: 'internship',
    kind: 'internship',
    start: '',
    end: '',
    title: '',
    background: '',
    action: '',
    contribution: '',
    result: '',
    metrics: [],
    skipped: [],
  }
}

function applyAnswer(draft: InterviewDraft, slot: InterviewSlot, answer: string): InterviewDraft {
  const d = { ...draft, metrics: [...draft.metrics], skipped: [...draft.skipped] }
  const text = answer.trim()
  const skip = () => {
    if (!d.skipped.includes(slot)) d.skipped.push(slot)
  }
  if (SKIP.test(text)) {
    skip()
    return d
  }
  switch (slot) {
    case 'role': {
      const { type, kind } = detectType(`${d.org} ${text}`)
      d.employmentType = type
      d.kind = kind
      d.role = text.replace(/[，,、]?\s*(是)?(实习|全职|兼职|课程项目|个人项目|竞赛项目|科研项目|志愿者)(生)?$/, '').trim() || text
      break
    }
    case 'time': {
      const dates = text.match(/\d{4}\s*[.\-/年]\s*\d{1,2}/g) ?? []
      d.start = dates[0] ? normDate(dates[0]) : text
      d.end = /至今|现在|还在/.test(text) ? '至今' : dates[1] ? normDate(dates[1]) : ''
      if (!d.end) skip()
      break
    }
    case 'metrics':
      d.metrics = text
        .split(/[，,、；;\n]/)
        .map((s) => s.trim())
        .filter((s) => /\d/.test(s))
      if (d.metrics.length === 0) skip()
      break
    default:
      d[slot] = text
  }
  return d
}

export function emptyEventDraft(): ChatEventDraft {
  return { title: '', background: '', action: '', result: '', contribution: '', metrics: [], signals: [], lead: '', text: '' }
}

export function emptyChatDraft(): ChatDraft {
  return { org: '', role: '', kind: 'internship', employmentType: 'internship', start: '', end: '', summary: '', events: [], skipped: [] }
}

/** 本地规则版的对话整理：每次追问一个缺口，把回答填进当前这件事 */
export function interviewLocally(input: InterviewInput): InterviewOutput {
  const { draft, messages } = input
  const ev = draft.events[draft.events.length - 1] ?? emptyEventDraft()
  const single: InterviewDraft = {
    org: draft.org,
    role: draft.role,
    employmentType: draft.employmentType,
    kind: draft.kind,
    start: draft.start,
    end: draft.end,
    title: ev.title,
    background: ev.background,
    action: ev.action,
    contribution: ev.contribution,
    result: ev.result,
    metrics: ev.metrics,
    skipped: draft.skipped ?? [],
  }
  const last = messages[messages.length - 1]
  let next = single
  if (last?.from === 'user') {
    const slot = nextInterviewSlot(single)
    if (slot) next = applyAnswer(single, slot, last.text)
  }
  const nextSlot = nextInterviewSlot(next)
  const evOut: ChatEventDraft = {
    ...ev,
    title: next.title,
    background: next.background,
    action: next.action,
    contribution: next.contribution,
    result: next.result,
    metrics: next.metrics,
  }
  if (!nextSlot && evOut.action && !evOut.text) {
    const r = rewriteLocally({ lead: '', text: '', facts: { ...evOut } })
    evOut.lead = r.lead
    evOut.text = r.text
  }
  return {
    reply: nextSlot ? QUESTIONS[nextSlot](next) : '信息够整理成一件事了。右边是整理结果，每一项都可以直接改，没问题就保存到事实库。',
    draft: {
      ...draft,
      org: next.org,
      role: next.role,
      kind: next.kind,
      employmentType: next.employmentType,
      start: next.start,
      end: next.end,
      skipped: next.skipped,
      events: [...draft.events.slice(0, Math.max(0, draft.events.length - 1)), evOut],
    },
    done: !nextSlot,
    quickReplies: nextSlot ? ['跳过', ...(nextSlot === 'time' ? ['至今'] : [])] : [],
  }
}

/* ---------- 旧简历解析 ---------- */

const RANGE =
  /(\d{4}(?:\s*[.\-/年]\s*\d{1,2})?)\s*月?\s*[-–—~～至到]+\s*(\d{4}(?:\s*[.\-/年]\s*\d{1,2})?\s*月?|至今|现在|今)/
const DEGREE = /本科|学士|硕士|研究生|博士|专科|大专/
const isBullet = (line: string) => /^\s*(?:[-*•·●▪]|\d+[.、)）]|[（(]\d+[)）])/.test(line)
const isContact = (line: string) => /1\d{2}[-\s]?\d{4}[-\s]?\d{4}|@|微信|电话|邮箱|github\.com/i.test(line)

const ROLE = /(实习生|实习|工程师|开发|助理|负责人|成员|组长|队长|队员|编辑|干事|部长|主席|会长|社长|委员|经理|专员|研究员|设计师|分析师|顾问|主管|总监|运营|策划|讲师|助教|leader|intern|engineer|manager)/i

/** 标题行拆成机构和职位：从第一个像职位的词开始算职位；项目类没有职位时整行都是名称 */
function splitHead(parts: string[], wholeIsName: boolean) {
  const i = parts.findIndex((p, k) => k > 0 && ROLE.test(p))
  if (i > 0) return { org: parts.slice(0, i).join(' '), role: parts.slice(i).join(' ') }
  if (wholeIsName) return { org: parts.join(' '), role: '' }
  return { org: parts[0] ?? '', role: parts.slice(1).join(' ') }
}

function splitLead(body: string) {
  const idx = body.search(/[：:]/)
  const lead = idx > 0 && idx <= 14 ? body.slice(0, idx).replace(/\*\*/g, '').trim() : ''
  return { lead, text: (lead ? body.slice(idx + 1) : body).replace(/\*\*/g, '').trim() }
}

export function parseResumeText(text: string): ParsedResume {
  const lines = text.split(/\r?\n/).map((l) => l.trim())
  const contacts = {
    name: lines.find((l) => /^[一-鿿]{2,4}$/.test(l) && !headingHint(l)) ?? '',
    phone: text.match(/1\d{2}[-\s]?\d{4}[-\s]?\d{4}/)?.[0] ?? '',
    email: text.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] ?? '',
  }

  type Draft = { head: string; date: RegExpMatchArray | null; hint: SectionHint | null; body: string[]; role?: string }
  const drafts: Draft[] = []
  const honors: ParsedResume['honors'] = []
  const skills: ParsedResume['skills'] = []
  let hint: SectionHint | null = null
  let current: Draft | null = null

  for (const line of lines) {
    if (!line || line === contacts.name) continue
    const h = headingHint(line)
    if (h) {
      hint = h
      current = null
      continue
    }
    if (hint === 'contact' || (!current && isContact(line))) continue
    if (hint === 'summary') continue
    if (hint === 'honor') {
      const body = stripBullet(line)
      const date = body.match(/\d{4}(?:\s*[.\-/年]\s*\d{1,2})?/)?.[0] ?? ''
      const title = body.replace(date, '').replace(/[（()）]\s*[）)]?/g, '').replace(/\s+/g, ' ').trim()
      if (title) honors.push({ id: uid('hon'), title, date: date ? normDate(date) : '', issuer: '' })
      continue
    }
    if (hint === 'skill') {
      const body = stripBullet(line)
      const m = body.match(/^([^：:]{1,8})[：:](.+)$/)
      const items = (m ? m[2] : body)
        .split(/[、,，;；/|｜]/)
        .map((s) => s.trim())
        .filter(Boolean)
      if (items.length) skills.push({ id: uid('sk'), label: m ? m[1].trim() : '技能', items })
      continue
    }
    const m = line.match(RANGE)
    if (m) {
      current = { head: line, date: m, hint, body: [] }
      drafts.push(current)
      continue
    }
    if (current) {
      // 紧跟标题行、没有标点的短行，多半是职位
      if (!current.role && current.body.length === 0 && line.length <= 18 && !isBullet(line) && !/[，。；：:]/.test(line)) current.role = line
      else current.body.push(line)
    } else if (hint && !isBullet(line) && line.length <= 30 && !/[，。；]/.test(line)) {
      // 没写时间的经历：栏目下的一行短标题
      current = { head: line, date: null, hint, body: [] }
      drafts.push(current)
    }
  }

  const entries: ParsedEntry[] = drafts.map((d) => {
    const headClean = (d.date ? d.head.replace(d.date[0], ' ') : d.head)
      .replace(/[|｜·/,，]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const parts = headClean.split(' ').filter(Boolean)
    const all = [d.head, d.role ?? '', ...d.body].join('\n')
    const c = classifyEntry(all, d.hint, `${headClean} ${d.role ?? ''}`)
    const rawText = [d.head, d.role, ...d.body].filter(Boolean).join('\n')
    const start = d.date ? normDate(d.date[1]) : ''
    const end = d.date ? normDate(d.date[2]) : ''
    if (c.category === 'education') {
      const degree = all.match(DEGREE)?.[0] ?? ''
      return {
        id: uid('edu'),
        category: 'education',
        reason: c.reason,
        org: parts[0] ?? '',
        role: [parts.slice(1).join(' '), d.role ?? ''].join(' ').replace(degree, '').replace(/\s+/g, ' ').trim(),
        degree,
        employmentType: 'full-time',
        start,
        end,
        // “本科，GPA 3.6”这一行里学历已经单独识别，补充说明里不再重复
        details: d.body
          .map(stripBullet)
          .map((l) => (degree ? l.replace(new RegExp(`^${degree}[，,、；;\\s]*`), '') : l))
          .filter(Boolean)
          .join('；'),
        rawText,
        items: [],
      }
    }
    const items = d.body
      .map(stripBullet)
      .filter((b) => b.length >= 4)
      .map((b) => ({ id: uid('it'), ...splitLead(b) }))
    const head = splitHead(parts, c.category === 'project' || c.category === 'research')
    return {
      id: uid('exp'),
      category: c.category,
      reason: c.reason,
      org: head.org,
      role: [head.role, d.role ?? ''].join(' ').replace(/[（(][^)）]*[)）]/g, '').replace(/\s+/g, ' ').trim(),
      degree: '',
      employmentType: c.type,
      start,
      end,
      details: '',
      rawText,
      items,
    }
  })

  return { contacts, entries, honors, skills }
}

/* ---------- Provider ---------- */

export const mockProvider: AiProvider = {
  name: '本地规则（未接入模型）',

  async parseJob(raw) {
    await wait(450)
    return parseJobText(raw)
  },

  async matchRequirements(library, requirements) {
    await wait(350)
    return matchRequirements(library, requirements)
  },

  async interview(input) {
    if (input.messages.length) await wait(380)
    return interviewLocally(input)
  },

  async rewrite(input) {
    await wait(650)
    return rewriteLocally(input)
  },

  async parseResume(text) {
    await wait(600)
    return parseResumeText(text)
  },
}
