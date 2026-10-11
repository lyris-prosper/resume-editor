import { KIND_LABEL, KIND_ORDER, type Event, type ExperienceKind, type JobPick, type JobTarget, type Library, type Resume, type ResumeItem, type ResumeSection, type TemplateId } from './schema'
import { byTimeDesc, dateRange, roleLine } from './format'
import { uid } from './ids'
import { TEMPLATE_ACCENT } from './templates'

export type Pick = JobPick

export interface PickProblem {
  eventId: string
  reason: string
}

/**
 * 程序侧的硬校验：AI 或用户给出的选材必须指向存在的事件和表达。
 * 模型只能辅助，不能绕过这里。
 */
export function validatePicks(library: Library, picks: Pick[]): PickProblem[] {
  const problems: PickProblem[] = []
  const seen = new Set<string>()
  for (const p of picks) {
    const ev = library.events.find((e) => e.id === p.eventId)
    if (!ev) {
      problems.push({ eventId: p.eventId, reason: '事实库里没有这件事' })
      continue
    }
    if (seen.has(ev.id)) problems.push({ eventId: ev.id, reason: '同一件事只能选用一种表达' })
    seen.add(ev.id)
    if (p.variantId && !ev.variants.some((x) => x.id === p.variantId)) problems.push({ eventId: ev.id, reason: `“${ev.title}”没有所选的表达` })
    if (!library.experiences.some((x) => x.id === ev.experienceId)) problems.push({ eventId: ev.id, reason: `“${ev.title}”所属的经历不存在` })
  }
  return problems
}

/** 一件事用于简历的文字：选中的表达，没有表达时由事实拼成 */
export function eventLine(ev: Event, variantId?: string) {
  const v = ev.variants.find((x) => x.id === variantId) ?? ev.variants[0]
  if (v) return { variantId: v.id, lead: v.lead, text: v.text }
  const text = [ev.action, ev.result]
    .map((s) => s.trim().replace(/[。；;，,]+$/, ''))
    .filter(Boolean)
    .join('，')
  return { variantId: undefined, lead: ev.title, text: text ? `${text}。` : '' }
}

export const DEFAULT_STYLE = { fontScale: 1, lineHeight: 1.55, accent: '#111111' }

/** 从事实库按选材组装一份独立的简历快照（复制文字，不引用） */
export function assembleResume(opts: { library: Library; picks: Pick[]; template: TemplateId; job?: JobTarget }): Resume {
  const { library, picks, template, job } = opts
  const { profile } = library
  const now = Date.now()

  const pickedByExp = new Map<string, Pick[]>()
  for (const p of picks) {
    const ev = library.events.find((e) => e.id === p.eventId)
    if (!ev) continue
    pickedByExp.set(ev.experienceId, [...(pickedByExp.get(ev.experienceId) ?? []), p])
  }

  const experienceItems = (kind: ExperienceKind): ResumeItem[] => {
    const exps = library.experiences.filter((e) => e.kind === kind && pickedByExp.has(e.id))
    return byTimeDesc(exps, (e) => e).map((exp) => ({
      id: uid('ri'),
      experienceId: exp.id,
      heading: exp.org,
      subheading: roleLine(exp),
      date: dateRange(exp.start, exp.end),
      hidden: false,
      bullets: (pickedByExp.get(exp.id) ?? []).map((p) => {
        const ev = library.events.find((e) => e.id === p.eventId)!
        const line = eventLine(ev, p.variantId)
        return { id: uid('rb'), eventId: ev.id, variantId: line.variantId, lead: line.lead, text: line.text, hidden: false }
      }),
    }))
  }

  const education: ResumeItem[] = byTimeDesc(profile.education, (e) => e).map((e) => ({
    id: uid('ri'),
    heading: e.school,
    subheading: [e.major, e.degree].filter(Boolean).join('，'),
    date: dateRange(e.start, e.end),
    hidden: false,
    bullets: e.details ? [{ id: uid('rb'), lead: '', text: e.details, hidden: false }] : [],
  }))

  const honors = byTimeDesc(library.honors, (h) => ({ start: h.date, end: h.date }))
  const skills = library.skills.filter((s) => s.label || s.items.length)

  const sections: ResumeSection[] = [
    { id: uid('rs'), kind: 'education', title: '教育背景', hidden: false, items: education },
    ...KIND_ORDER.map((kind) => ({ id: uid('rs'), kind, title: KIND_LABEL[kind], hidden: false, items: experienceItems(kind) })),
    {
      id: uid('rs'),
      kind: 'honor',
      title: '荣誉奖项',
      hidden: false,
      items: honors.map((h) => ({ id: uid('ri'), heading: h.title, subheading: h.issuer, date: h.date, hidden: false, bullets: [] })),
    },
    {
      id: uid('rs'),
      kind: 'skill',
      title: '专业技能',
      hidden: false,
      items: skills.map((s) => ({ id: uid('ri'), heading: s.label, subheading: s.items.join('、'), date: '', hidden: false, bullets: [] })),
    },
  ]

  const contacts = [profile.phone, profile.email, profile.city, ...profile.links.map((l) => l.url)].filter(Boolean)

  return {
    id: uid('cv'),
    name: job ? `${job.company || '未识别公司'} · ${job.title || '未识别职位'}` : `通用简历 ${new Date(now).toLocaleDateString('zh-CN')}`,
    jobId: job?.id,
    template,
    style: { ...DEFAULT_STYLE, accent: TEMPLATE_ACCENT[template] },
    header: { name: profile.name, headline: job?.title || profile.headline || '', contacts, summary: profile.summary },
    sections: sections.filter((s) => s.items.length > 0),
    createdAt: now,
    updatedAt: now,
  }
}

/** 简历中实际采用的事件 ID，用于内部溯源，不渲染到导出文件 */
export function sourceItems(resume: Resume) {
  return resume.sections.flatMap((s) =>
    s.hidden ? [] : s.items.flatMap((i) => (i.hidden ? [] : i.bullets.filter((b) => !b.hidden && b.eventId).map((b) => b.eventId!))),
  )
}

/** 内容多少：用来推荐版式 */
export function contentVolume(resume: Resume) {
  const visible = resume.sections.filter((s) => !s.hidden)
  const bullets = visible.reduce((n, s) => n + s.items.filter((i) => !i.hidden).reduce((m, i) => m + i.bullets.filter((b) => !b.hidden).length, 0), 0)
  const items = visible.reduce((n, s) => n + s.items.filter((i) => !i.hidden).length, 0)
  const chars = visible.reduce(
    (n, s) => n + s.items.reduce((m, i) => m + i.heading.length + i.subheading.length + i.bullets.reduce((k, b) => k + b.lead.length + b.text.length, 0), 0),
    0,
  )
  return { bullets, items, chars, rich: bullets >= 12 || chars >= 1100 }
}
