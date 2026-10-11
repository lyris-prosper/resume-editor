import { z } from 'zod'
import { CATEGORY_ORDER, EmploymentType, ExperienceKind, KIND_TYPES, RequirementKind, type Category } from '../schema'
import { classifyEntry } from '../classify'
import { normDate } from '../format'
import { uid } from '../ids'
import type { ChatDraft, InterviewOutput, ParsedJob, ParsedResume, RewriteOutput } from './types'

/**
 * 模型返回的 JSON 先过一遍这里：缺字段补默认值，枚举不合法时退回合理的值，
 * 让页面拿到的永远是完整、可用的数据。
 */

const str = z.preprocess((v) => (v === null || v === undefined ? '' : typeof v === 'string' ? v : String(v)), z.string())
const strList = z.preprocess((v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' || typeof x === 'number').map(String) : []), z.array(z.string()))
const list = <T extends z.ZodType>(item: T) => z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(item))

/* ---------- 重写 ---------- */

const RewriteWire = z.object({
  firstLook: str,
  lead: str,
  text: str,
  insights: list(z.object({ label: str, evidence: str })),
  metrics: list(
    z.object({
      label: str,
      value: str,
      status: z.enum(['used', 'missing']).catch('missing'),
      question: str,
      hint: str,
    }),
  ),
  notes: strList,
  asks: strList,
})

export function toRewrite(raw: unknown): RewriteOutput {
  const r = RewriteWire.parse(raw)
  return {
    firstLook: r.firstLook.trim() || undefined,
    lead: r.lead.trim().replace(/[：:]$/, ''),
    text: r.text.trim(),
    insights: r.insights.filter((i) => i.label).slice(0, 3),
    metrics: r.metrics.filter((m) => m.label).slice(0, 6),
    notes: r.notes.filter(Boolean).slice(0, 5),
    asks: r.asks.filter(Boolean).slice(0, 2),
  }
}

/* ---------- 对话整理 ---------- */

const EventWire = z.object({
  id: str,
  title: str,
  background: str,
  action: str,
  result: str,
  contribution: str,
  metrics: strList,
  signals: strList,
  lead: str,
  text: str,
})

const InterviewWire = z.object({
  reply: str,
  draft: z
    .object({
      org: str,
      role: str,
      kind: ExperienceKind.catch('internship'),
      employmentType: EmploymentType.catch('internship'),
      start: str,
      end: str,
      summary: str,
      events: list(EventWire),
    })
    .catch({ org: '', role: '', kind: 'internship', employmentType: 'internship', start: '', end: '', summary: '', events: [] }),
  done: z.boolean().catch(false),
  quickReplies: strList,
})

export function toInterview(raw: unknown, prev: ChatDraft): InterviewOutput {
  const r = InterviewWire.parse(raw)
  const known = new Set(prev.events.map((e) => e.id).filter(Boolean))
  const d = r.draft
  const kind = d.kind
  const draft: ChatDraft = {
    ...d,
    // 模型没给的字段沿用上一轮，避免信息丢失
    org: d.org || prev.org,
    role: d.role || prev.role,
    start: normDate(d.start) || prev.start,
    end: normDate(d.end) || prev.end,
    summary: d.summary || prev.summary,
    kind,
    employmentType: KIND_TYPES[kind].includes(d.employmentType) ? d.employmentType : KIND_TYPES[kind][0],
    events: (d.events.length ? d.events : prev.events).map((e) => ({
      ...e,
      id: e.id && known.has(e.id) ? e.id : undefined,
      // 概括短语偶尔会写成整句话：退回事件名称
      lead: e.lead && e.lead.length <= 14 && e.lead !== e.text ? e.lead : e.title,
    })),
    skipped: prev.skipped,
  }
  return { reply: r.reply.trim() || '收到。还有什么想补充的吗？', draft, done: r.done, quickReplies: r.quickReplies.slice(0, 3) }
}

/* ---------- 简历解析 ---------- */

const EntryWire = z.object({
  category: z.string().catch('work'),
  reason: str,
  org: str,
  role: str,
  degree: str,
  employmentType: EmploymentType.catch('full-time'),
  start: str,
  end: str,
  details: str,
  rawText: str,
  items: list(z.object({ lead: str, text: str })),
})

const ResumeWire = z.object({
  contacts: z.object({ name: str, phone: str, email: str }).catch({ name: '', phone: '', email: '' }),
  entries: list(EntryWire),
  honors: list(z.object({ title: str, date: str, issuer: str })),
  skills: list(z.object({ label: str, items: strList })),
})

export function toParsedResume(raw: unknown): ParsedResume {
  const r = ResumeWire.parse(raw)
  return {
    contacts: r.contacts,
    entries: r.entries
      .filter((e) => e.org || e.items.length || e.details)
      .map((e) => {
        let category = (CATEGORY_ORDER as string[]).includes(e.category) ? (e.category as Category) : null
        let reason = e.reason
        if (!category) {
          const c = classifyEntry([e.org, e.role, e.rawText].join('\n'))
          category = c.category
          reason = c.reason
        }
        const employmentType = category === 'education' ? 'full-time' : KIND_TYPES[category].includes(e.employmentType) ? e.employmentType : KIND_TYPES[category][0]
        return {
          id: uid(category === 'education' ? 'edu' : 'exp'),
          category,
          reason: reason || 'AI 判断',
          org: e.org,
          role: e.role,
          degree: e.degree,
          employmentType,
          start: normDate(e.start),
          end: normDate(e.end),
          details: e.details,
          rawText: e.rawText,
          items: category === 'education' ? [] : e.items.filter((i) => i.text.trim()).map((i) => ({ id: uid('it'), lead: i.lead, text: i.text })),
        }
      }),
    honors: r.honors.filter((h) => h.title).map((h) => ({ id: uid('hon'), title: h.title, date: normDate(h.date), issuer: h.issuer })),
    skills: r.skills.filter((s) => s.items.length).map((s) => ({ id: uid('sk'), label: s.label || '技能', items: s.items })),
  }
}

/* ---------- 岗位解析 ---------- */

const JobWire = z.object({
  company: str,
  title: str,
  location: str,
  responsibilities: strList,
  requirements: list(z.object({ kind: RequirementKind.catch('core'), text: str })),
})

export function toParsedJob(raw: unknown): ParsedJob {
  const r = JobWire.parse(raw)
  return { ...r, requirements: r.requirements.filter((q) => q.text.trim()) }
}
