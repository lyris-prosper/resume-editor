import type { ExperienceKind } from '../lib/schema'

/* ---------- 旧版本数据迁移 ---------- */

type Loose = Record<string, unknown> & { status?: unknown }
const strip = <T extends Loose>(o: T) => {
  const { status: _status, ...rest } = o
  return rest
}

/** v1：经历只有“工作 / 项目”两类，并且每条都有确认状态 */
function kindFromV1(e: { kind?: string; employmentType?: string }): ExperienceKind {
  if (e.employmentType === 'research') return 'research'
  if (e.kind === 'project') return 'project'
  switch (e.employmentType) {
    case 'internship':
      return 'internship'
    case 'campus':
    case 'volunteer':
      return 'campus'
    case 'course':
    case 'personal':
    case 'competition':
      return 'project'
    default:
      return 'work'
  }
}

export function migrateV1(state: any) {
  if (!state?.library) return state
  const lib = state.library
  lib.profile = { headline: '', ...lib.profile, education: (lib.profile?.education ?? []).map(strip) }
  lib.experiences = (lib.experiences ?? []).map((e: Loose & { kind?: string; employmentType?: string }) => ({ ...strip(e), kind: kindFromV1(e) }))
  lib.events = (lib.events ?? []).map((e: Loose & { variants?: Loose[] }) => ({ ...strip(e), variants: (e.variants ?? []).map(strip) }))
  lib.honors = (lib.honors ?? []).map(strip)
  lib.skills = (lib.skills ?? []).map(strip)
  state.jobs = (state.jobs ?? []).map((j: Loose) => ({ picks: [], ...j }))
  state.resumes = (state.resumes ?? []).map((r: Loose & { header?: Loose }) => ({ ...r, header: { headline: '', ...r.header } }))
  return state
}
