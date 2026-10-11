import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'
import {
  KIND_TYPES,
  type Education,
  type Event,
  type Experience,
  type ExperienceKind,
  type Honor,
  type JobTarget,
  type Library,
  type Profile,
  type Resume,
  type SkillGroup,
  type Variant,
} from '../lib/schema'
import { seedLibrary } from '../data/seed'
import { uid } from '../lib/ids'
import { migrateV1 } from './migrate'

const idbStorage: StateStorage = {
  getItem: async (name) => (await idbGet<string>(name)) ?? null,
  setItem: async (name, value) => idbSet(name, value),
  removeItem: async (name) => idbDel(name),
}

/** 克隆后修改，避免在组件里手写多层展开 */
function edit<T>(value: T, fn: (draft: T) => void): T {
  const draft = structuredClone(value)
  fn(draft)
  return draft
}

/** 采纳 AI 重写：改写已有的表达，或者新增一个角度 */
export interface RewritePatch {
  variantId?: string
  angle: string
  lead: string
  text: string
}

/** 导入核对后一次性写入的内容 */
export interface ImportBatch {
  experiences: Experience[]
  events: Event[]
  education: Education[]
  honors: Honor[]
  skills: SkillGroup[]
  contacts?: { name?: string; phone?: string; email?: string }
}

export interface AppState {
  library: Library
  /** 事件被覆盖前的旧版本，用于查看历史和撤销 */
  eventHistory: Record<string, Event[]>
  jobs: JobTarget[]
  resumes: Resume[]

  updateProfile: (fn: (p: Profile) => void) => void
  upsertExperience: (exp: Experience) => void
  deleteExperience: (id: string) => void
  upsertEvent: (ev: Event) => void
  deleteEvent: (id: string) => void
  addVariant: (eventId: string, v: Variant) => void
  applyRewrite: (eventId: string, patch: RewritePatch) => string | undefined
  /** 用户补上的数字记进事实，之后的数字检查以它为依据 */
  addMetrics: (eventId: string, metrics: string[]) => void
  restoreEventVersion: (eventId: string, version: number) => void
  upsertHonor: (h: Honor) => void
  deleteHonor: (id: string) => void
  upsertSkill: (s: SkillGroup) => void
  deleteSkill: (id: string) => void
  /** 经历 → 教育背景；其中的事并入补充说明 */
  experienceToEducation: (id: string) => string | undefined
  /** 教育背景 → 某一类经历 */
  educationToExperience: (id: string, kind: ExperienceKind) => string | undefined
  importBatch: (batch: ImportBatch) => void

  upsertJob: (job: JobTarget) => void
  /** 把一件事（用指定的写法）放进岗位的选材；已经选了就换成这个写法 */
  pickForJob: (jobId: string, eventId: string, variantId?: string) => void
  deleteJob: (id: string) => void

  upsertResume: (r: Resume) => void
  updateResume: (id: string, fn: (r: Resume) => void) => void
  deleteResume: (id: string) => void

  replaceAll: (data: { library: Library; jobs: JobTarget[]; resumes: Resume[] }) => void
  loadDemo: () => void
  clearAll: () => void
}

const EMPTY_LIBRARY: Library = {
  profile: { name: '', headline: '', phone: '', email: '', city: '', links: [], summary: '', education: [] },
  experiences: [],
  events: [],
  honors: [],
  skills: [],
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      library: seedLibrary,
      eventHistory: {},
      jobs: [],
      resumes: [],

      updateProfile: (fn) => set((s) => ({ library: { ...s.library, profile: edit(s.library.profile, fn) } })),

      upsertExperience: (exp) =>
        set((s) => {
          const exists = s.library.experiences.some((e) => e.id === exp.id)
          const next = { ...exp, updatedAt: Date.now() }
          return {
            library: {
              ...s.library,
              experiences: exists ? s.library.experiences.map((e) => (e.id === exp.id ? next : e)) : [...s.library.experiences, next],
            },
          }
        }),

      deleteExperience: (id) =>
        set((s) => ({
          library: {
            ...s.library,
            experiences: s.library.experiences.filter((e) => e.id !== id),
            events: s.library.events.filter((e) => e.experienceId !== id),
          },
        })),

      upsertEvent: (ev) =>
        set((s) => {
          const prev = s.library.events.find((e) => e.id === ev.id)
          const next: Event = { ...ev, version: prev ? prev.version + 1 : 1, updatedAt: Date.now() }
          return {
            eventHistory: prev ? { ...s.eventHistory, [ev.id]: [...(s.eventHistory[ev.id] ?? []), prev] } : s.eventHistory,
            library: {
              ...s.library,
              events: prev ? s.library.events.map((e) => (e.id === ev.id ? next : e)) : [...s.library.events, next],
            },
          }
        }),

      deleteEvent: (id) => set((s) => ({ library: { ...s.library, events: s.library.events.filter((e) => e.id !== id) } })),

      addVariant: (eventId, v) => {
        const prev = get().library.events.find((e) => e.id === eventId)
        if (prev) get().upsertEvent({ ...prev, variants: [...prev.variants, v] })
      },

      applyRewrite: (eventId, patch) => {
        const prev = get().library.events.find((e) => e.id === eventId)
        if (!prev) return
        const existing = prev.variants.find((v) => v.id === patch.variantId)
        if (existing) {
          get().upsertEvent({
            ...prev,
            variants: prev.variants.map((v) => (v.id === existing.id ? { ...v, lead: patch.lead, text: patch.text, origin: 'ai' } : v)),
          })
          return existing.id
        }
        const v: Variant = { id: uid('va'), angle: patch.angle, lead: patch.lead, text: patch.text, origin: 'ai', createdAt: Date.now() }
        get().upsertEvent({ ...prev, variants: [...prev.variants, v] })
        return v.id
      },

      addMetrics: (eventId, metrics) => {
        const prev = get().library.events.find((e) => e.id === eventId)
        if (prev && metrics.length) get().upsertEvent({ ...prev, metrics: [...new Set([...prev.metrics, ...metrics])] })
      },

      restoreEventVersion: (eventId, version) =>
        set((s) => {
          const history = s.eventHistory[eventId] ?? []
          const target = history.find((h) => h.version === version)
          const current = s.library.events.find((e) => e.id === eventId)
          if (!target || !current) return {}
          const restored: Event = { ...target, version: current.version + 1, updatedAt: Date.now() }
          return {
            eventHistory: { ...s.eventHistory, [eventId]: [...history, current] },
            library: { ...s.library, events: s.library.events.map((e) => (e.id === eventId ? restored : e)) },
          }
        }),

      upsertHonor: (h) =>
        set((s) => {
          const exists = s.library.honors.some((x) => x.id === h.id)
          return { library: { ...s.library, honors: exists ? s.library.honors.map((x) => (x.id === h.id ? h : x)) : [...s.library.honors, h] } }
        }),
      deleteHonor: (id) => set((s) => ({ library: { ...s.library, honors: s.library.honors.filter((x) => x.id !== id) } })),

      upsertSkill: (sk) =>
        set((s) => {
          const exists = s.library.skills.some((x) => x.id === sk.id)
          return { library: { ...s.library, skills: exists ? s.library.skills.map((x) => (x.id === sk.id ? sk : x)) : [...s.library.skills, sk] } }
        }),
      deleteSkill: (id) => set((s) => ({ library: { ...s.library, skills: s.library.skills.filter((x) => x.id !== id) } })),

      experienceToEducation: (id) => {
        const s = get()
        const exp = s.library.experiences.find((e) => e.id === id)
        if (!exp) return
        const events = s.library.events.filter((e) => e.experienceId === id)
        const degree = `${exp.role} ${exp.summary} ${exp.rawText}`.match(/本科|学士|硕士|研究生|博士|专科|大专/)?.[0] ?? ''
        const edu: Education = {
          id: uid('edu'),
          school: exp.org,
          degree,
          major: exp.role.replace(degree, '').trim(),
          start: exp.start,
          end: exp.end,
          details: [exp.summary, ...events.map((e) => eventText(e))].filter(Boolean).join('；'),
        }
        set((st) => ({
          library: {
            ...st.library,
            profile: { ...st.library.profile, education: [...st.library.profile.education, edu] },
            experiences: st.library.experiences.filter((e) => e.id !== id),
            events: st.library.events.filter((e) => e.experienceId !== id),
          },
        }))
        return edu.id
      },

      educationToExperience: (id, kind) => {
        const edu = get().library.profile.education.find((e) => e.id === id)
        if (!edu) return
        const exp: Experience = {
          id: uid('exp'),
          kind,
          org: edu.school,
          role: edu.major,
          employmentType: KIND_TYPES[kind][0],
          start: edu.start,
          end: edu.end,
          summary: '',
          rawText: [edu.school, edu.degree, edu.major, edu.details].filter(Boolean).join(' '),
          version: 1,
          updatedAt: Date.now(),
        }
        const events: Event[] = edu.details
          .split(/[；;\n]/)
          .map((t) => t.trim())
          .filter((t) => t.length >= 4)
          .map((t) => newEvent(exp.id, t))
        set((st) => ({
          library: {
            ...st.library,
            profile: { ...st.library.profile, education: st.library.profile.education.filter((e) => e.id !== id) },
            experiences: [...st.library.experiences, exp],
            events: [...st.library.events, ...events],
          },
        }))
        return exp.id
      },

      importBatch: (b) =>
        set((s) => {
          const profile = structuredClone(s.library.profile)
          if (b.contacts?.name) profile.name = b.contacts.name
          if (b.contacts?.phone) profile.phone = b.contacts.phone
          if (b.contacts?.email) profile.email = b.contacts.email
          profile.education.push(...b.education)
          const now = Date.now()
          // 同名的荣誉不重复添加；同名的技能分组合并条目
          const honors = [...s.library.honors, ...b.honors.filter((h) => !s.library.honors.some((x) => x.title.trim() === h.title.trim()))]
          const skills = structuredClone(s.library.skills)
          for (const g of b.skills) {
            const same = skills.find((x) => x.label.trim() === g.label.trim())
            if (same) same.items = [...new Set([...same.items, ...g.items])]
            else skills.push(g)
          }
          return {
            library: {
              profile,
              experiences: [...s.library.experiences, ...b.experiences.map((e) => ({ ...e, updatedAt: now }))],
              events: [...s.library.events, ...b.events.map((e) => ({ ...e, updatedAt: now }))],
              honors,
              skills,
            },
          }
        }),

      upsertJob: (job) =>
        set((s) => ({ jobs: s.jobs.some((j) => j.id === job.id) ? s.jobs.map((j) => (j.id === job.id ? job : j)) : [job, ...s.jobs] })),
      pickForJob: (jobId, eventId, variantId) =>
        set((s) => ({
          jobs: s.jobs.map((j) => {
            if (j.id !== jobId) return j
            const has = j.picks.some((p) => p.eventId === eventId)
            return { ...j, picks: has ? j.picks.map((p) => (p.eventId === eventId ? { ...p, variantId } : p)) : [...j.picks, { eventId, variantId }] }
          }),
        })),
      deleteJob: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),

      upsertResume: (r) =>
        set((s) => ({ resumes: s.resumes.some((x) => x.id === r.id) ? s.resumes.map((x) => (x.id === r.id ? r : x)) : [r, ...s.resumes] })),
      updateResume: (id, fn) =>
        set((s) => ({ resumes: s.resumes.map((r) => (r.id === id ? { ...edit(r, fn), updatedAt: Date.now() } : r)) })),
      deleteResume: (id) => set((s) => ({ resumes: s.resumes.filter((r) => r.id !== id) })),

      replaceAll: (data) => set({ ...data, eventHistory: {} }),
      loadDemo: () => set({ library: seedLibrary, eventHistory: {} }),
      clearAll: () => set({ library: EMPTY_LIBRARY, eventHistory: {}, jobs: [], resumes: [] }),
    }),
    {
      name: 'shili-workbench',
      version: 2,
      storage: createJSONStorage(() => idbStorage),
      migrate: (persisted, version) => (version < 2 ? migrateV1(persisted) : persisted) as AppState,
    },
  ),
)

/** 一件事的文字，用于并入说明 */
export function eventText(e: Event) {
  const v = e.variants[0]
  return v ? `${v.lead ? `${v.lead}：` : ''}${v.text}` : [e.title, e.action, e.result].filter(Boolean).join('：')
}

export function newEvent(experienceId: string, raw: string, givenLead = ''): Event {
  const now = Date.now()
  // “主修课程：数据库原理”这样的写法，冒号前是概括
  const m = givenLead ? null : raw.match(/^([^：:，,。]{2,10})[：:](.+)$/)
  const lead = givenLead || m?.[1].trim() || ''
  const text = m ? m[2].trim() : raw
  return {
    id: uid('ev'),
    experienceId,
    title: lead || text.replace(/[，。；].*$/, '').slice(0, 14),
    background: '',
    action: text,
    result: '',
    metrics: text.match(/\d+(?:\.\d+)?\s*(?:%|个|位|份|篇|次|场|人|万|小时|天|周|项|条|页|家)/g) ?? [],
    signals: [],
    contribution: '',
    evidence: 'self',
    sourceNote: '',
    variants: [{ id: uid('va'), angle: '原文', lead, text, origin: 'import', createdAt: now }],
    version: 1,
    updatedAt: now,
  }
}
