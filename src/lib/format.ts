import { EMPLOYMENT_LABEL, KIND_TYPES, type EmploymentType, type Experience, type ExperienceKind } from './schema'

export const ONGOING = '至今'

export function dateRange(start: string, end: string) {
  if (!start && !end) return ''
  return `${start || '?'}–${end || ONGOING}`
}

/** 栏目已经说明的性质（实习经历里的“实习”）不再重复标注 */
function typeSuffix(kind: ExperienceKind | undefined, type: EmploymentType) {
  if (type === 'full-time') return ''
  if (kind && KIND_TYPES[kind][0] === type && kind !== 'project') return ''
  return `（${EMPLOYMENT_LABEL[type]}）`
}

/** 简历上的职位一栏：“产品实习生”“负责人（课程项目）” */
export function roleLine(exp: Pick<Experience, 'role' | 'employmentType'> & { kind?: ExperienceKind }) {
  const suffix = typeSuffix(exp.kind, exp.employmentType)
  return exp.role ? `${exp.role}${suffix}` : suffix.replace(/[（）]/g, '')
}

/**
 * 经历标题：“机构 - 职位（任职性质）”。
 * 全职和栏目本身的性质不标注，其他性质明确标注；个人或课程项目不包装成正式任职。
 */
export function experienceHeading(exp: Pick<Experience, 'org' | 'role' | 'employmentType'> & { kind?: ExperienceKind }) {
  const role = roleLine(exp)
  return role ? `${exp.org} - ${role}` : exp.org
}

/** 把“2026.07”转成可比较的数字；“至今”视为最大 */
function stamp(value: string) {
  if (!value || value === ONGOING) return Number.POSITIVE_INFINITY
  const m = value.match(/(\d{4})(?:[.\-/年](\d{1,2}))?/)
  if (!m) return Number.NEGATIVE_INFINITY
  return Number(m[1]) * 100 + Number(m[2] ?? 0)
}

/** 时间倒序：进行中优先，其余按结束时间、再按开始时间倒序；无日期条目置底并保持原顺序 */
export function byTimeDesc<T>(items: T[], pick: (item: T) => { start: string; end: string }) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const pa = pick(a.item)
      const pb = pick(b.item)
      const undatedA = !pa.start && !pa.end
      const undatedB = !pb.start && !pb.end
      if (undatedA || undatedB) return undatedA === undatedB ? a.index - b.index : undatedA ? 1 : -1
      return stamp(pb.end) - stamp(pa.end) || stamp(pb.start) - stamp(pa.start) || a.index - b.index
    })
    .map(({ item }) => item)
}

export function relativeTime(ts: number) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 统一日期写法：2025.7 / 2025年7月 / 2025-07 → 2025.07 */
export function normDate(s: string) {
  if (!s) return ''
  if (/至今|现在|今|present|now/i.test(s)) return ONGOING
  const m = s.match(/(\d{4})\s*[.\-/年]?\s*(\d{1,2})?/)
  if (!m) return s.trim()
  return m[2] ? `${m[1]}.${m[2].padStart(2, '0')}` : m[1]
}
