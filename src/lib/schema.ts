import { z } from 'zod'

/** 证据充分性：仅自述，或附有材料 */
export const Evidence = z.enum(['self', 'attached'])
export type Evidence = z.infer<typeof Evidence>

export const EmploymentType = z.enum([
  'internship',
  'full-time',
  'part-time',
  'contract',
  'volunteer',
  'campus',
  'course',
  'personal',
  'competition',
  'research',
])
export type EmploymentType = z.infer<typeof EmploymentType>

export const EMPLOYMENT_LABEL: Record<EmploymentType, string> = {
  internship: '实习',
  'full-time': '全职',
  'part-time': '兼职',
  contract: '合同制',
  volunteer: '志愿者',
  campus: '校园组织',
  course: '课程项目',
  personal: '个人项目',
  competition: '竞赛项目',
  research: '科研项目',
}

/** 经历栏目。教育背景单独存放在 profile.education */
export const ExperienceKind = z.enum(['internship', 'work', 'research', 'project', 'campus'])
export type ExperienceKind = z.infer<typeof ExperienceKind>

export const KIND_ORDER: ExperienceKind[] = ['internship', 'work', 'research', 'project', 'campus']

export const KIND_LABEL: Record<ExperienceKind, string> = {
  internship: '实习经历',
  work: '工作经历',
  research: '科研经历',
  project: '项目经历',
  campus: '校园经历',
}

/** 每个栏目可选的性质。第一个是默认值，标题里不再重复标注 */
export const KIND_TYPES: Record<ExperienceKind, EmploymentType[]> = {
  internship: ['internship'],
  work: ['full-time', 'part-time', 'contract'],
  research: ['research'],
  project: ['course', 'personal', 'competition'],
  campus: ['campus', 'volunteer'],
}

/** 导入核对和事实库共用的分类：教育背景 + 五类经历 */
export type Category = 'education' | ExperienceKind
export const CATEGORY_ORDER: Category[] = ['education', ...KIND_ORDER]
export const CATEGORY_LABEL: Record<Category, string> = { education: '教育背景', ...KIND_LABEL }

/** 同一事件面向不同岗位角度的写法；同一份简历里互斥 */
export const Variant = z.object({
  id: z.string(),
  angle: z.string(),
  lead: z.string(),
  text: z.string(),
  /** 文字的来源：本人写的、AI 重写后本人采纳的、导入的原文 */
  origin: z.enum(['user', 'ai', 'import']),
  createdAt: z.number(),
})
export type Variant = z.infer<typeof Variant>

/** 事件（工作单元）：经历里的一件具体事 */
export const Event = z.object({
  id: z.string(),
  experienceId: z.string(),
  title: z.string(),
  background: z.string(),
  action: z.string(),
  result: z.string(),
  /** 可被引用的数字及其口径，例如“12 位受访者” */
  metrics: z.array(z.string()),
  signals: z.array(z.string()),
  /** 本人贡献边界，例如“负责记录与归类，未独立决定方案” */
  contribution: z.string(),
  evidence: Evidence,
  sourceNote: z.string(),
  variants: z.array(Variant),
  version: z.number(),
  updatedAt: z.number(),
})
export type Event = z.infer<typeof Event>

export const Experience = z.object({
  id: z.string(),
  kind: ExperienceKind,
  org: z.string(),
  role: z.string(),
  employmentType: EmploymentType,
  start: z.string(),
  end: z.string(),
  summary: z.string(),
  /** 导入或访谈时的原文，永久保留 */
  rawText: z.string(),
  version: z.number(),
  updatedAt: z.number(),
})
export type Experience = z.infer<typeof Experience>

export const Education = z.object({
  id: z.string(),
  school: z.string(),
  degree: z.string(),
  major: z.string(),
  start: z.string(),
  end: z.string(),
  details: z.string(),
})
export type Education = z.infer<typeof Education>

export const Profile = z.object({
  name: z.string(),
  /** 求职方向，例如“产品运营”；写在简历抬头姓名下方 */
  headline: z.string().default(''),
  phone: z.string(),
  email: z.string(),
  city: z.string(),
  links: z.array(z.object({ label: z.string(), url: z.string() })),
  summary: z.string(),
  education: z.array(Education),
})
export type Profile = z.infer<typeof Profile>

export const Honor = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(),
  issuer: z.string(),
})
export type Honor = z.infer<typeof Honor>

export const SkillGroup = z.object({
  id: z.string(),
  label: z.string(),
  items: z.array(z.string()),
})
export type SkillGroup = z.infer<typeof SkillGroup>

export const Library = z.object({
  profile: Profile,
  experiences: z.array(Experience),
  events: z.array(Event),
  honors: z.array(Honor),
  skills: z.array(SkillGroup),
})
export type Library = z.infer<typeof Library>

/* ---------- 岗位 ---------- */

/** duty = 岗位职责，core = 核心要求，hard = 硬性门槛，bonus = 加分项 */
export const RequirementKind = z.enum(['duty', 'core', 'hard', 'bonus'])
export type RequirementKind = z.infer<typeof RequirementKind>

export const Requirement = z.object({
  id: z.string(),
  kind: RequirementKind,
  text: z.string(),
})
export type Requirement = z.infer<typeof Requirement>

export const JobPick = z.object({ eventId: z.string(), variantId: z.string().optional() })
export type JobPick = z.infer<typeof JobPick>

export const JobTarget = z.object({
  id: z.string(),
  company: z.string(),
  title: z.string(),
  location: z.string(),
  raw: z.string(),
  responsibilities: z.array(z.string()),
  requirements: z.array(Requirement),
  /** 为这个岗位选中的事件；离开页面后再回来仍然保留 */
  picks: z.array(JobPick).default([]),
  createdAt: z.number(),
})
export type JobTarget = z.infer<typeof JobTarget>

/* ---------- 简历快照：持有文字副本，独立于事实库 ---------- */

export const TemplateId = z.enum(['classic', 'banner', 'elegant', 'airy', 'sidebar', 'dense', 'compact', 'academic'])
export type TemplateId = z.infer<typeof TemplateId>

export const ResumeBullet = z.object({
  id: z.string(),
  eventId: z.string().optional(),
  variantId: z.string().optional(),
  lead: z.string(),
  text: z.string(),
  hidden: z.boolean(),
})
export type ResumeBullet = z.infer<typeof ResumeBullet>

export const ResumeItem = z.object({
  id: z.string(),
  experienceId: z.string().optional(),
  /** 机构或学校 */
  heading: z.string(),
  /** 职位、专业等 */
  subheading: z.string(),
  date: z.string(),
  hidden: z.boolean(),
  bullets: z.array(ResumeBullet),
})
export type ResumeItem = z.infer<typeof ResumeItem>

export const SectionKind = z.enum(['education', 'internship', 'work', 'research', 'project', 'campus', 'honor', 'skill', 'summary'])
export type SectionKind = z.infer<typeof SectionKind>

export const ResumeSection = z.object({
  id: z.string(),
  kind: SectionKind,
  title: z.string(),
  hidden: z.boolean(),
  items: z.array(ResumeItem),
})
export type ResumeSection = z.infer<typeof ResumeSection>

export const ResumeStyle = z.object({
  fontScale: z.number(),
  lineHeight: z.number(),
  accent: z.string(),
})
export type ResumeStyle = z.infer<typeof ResumeStyle>

export const Resume = z.object({
  id: z.string(),
  name: z.string(),
  jobId: z.string().optional(),
  template: TemplateId,
  style: ResumeStyle,
  header: z.object({
    name: z.string(),
    headline: z.string().default(''),
    /** 证件照，data URL；部分版式显示 */
    photo: z.string().optional(),
    contacts: z.array(z.string()),
    summary: z.string(),
  }),
  sections: z.array(ResumeSection),
  createdAt: z.number(),
  updatedAt: z.number(),
})
export type Resume = z.infer<typeof Resume>

/** 经历类的简历章节 */
export const EXPERIENCE_SECTIONS: SectionKind[] = ['internship', 'work', 'research', 'project', 'campus']
