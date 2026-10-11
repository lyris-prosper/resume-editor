import type { Category, EmploymentType, Event, ExperienceKind, Library, Requirement } from '../schema'
import type { RequirementMatch } from '../match'

export interface ParsedJob {
  company: string
  title: string
  location: string
  responsibilities: string[]
  requirements: Omit<Requirement, 'id'>[]
}

/** 访谈时正在形成的草稿；空字符串表示尚未问到或用户跳过 */
export interface InterviewDraft {
  org: string
  role: string
  employmentType: EmploymentType
  kind: ExperienceKind
  start: string
  end: string
  title: string
  background: string
  action: string
  contribution: string
  result: string
  metrics: string[]
  /** 用户选择跳过的缺口，不再追问 */
  skipped: InterviewSlot[]
}

export type InterviewSlot = 'org' | 'role' | 'time' | 'title' | 'background' | 'action' | 'contribution' | 'result' | 'metrics'

/* ---------- 和 AI 聊一段：对话里整理出的经历草稿 ---------- */

export interface ChatEventDraft {
  /** 已在事实库里的事件保留原 id */
  id?: string
  title: string
  background: string
  action: string
  result: string
  contribution: string
  metrics: string[]
  signals: string[]
  /** AI 按事实起草的简历表达 */
  lead: string
  text: string
}

export interface ChatDraft {
  org: string
  role: string
  kind: ExperienceKind
  employmentType: EmploymentType
  start: string
  end: string
  summary: string
  events: ChatEventDraft[]
  /** 本地规则用：用户跳过的问题 */
  skipped?: InterviewSlot[]
}

export interface ChatMessage {
  from: 'ai' | 'user'
  text: string
}

export interface InterviewInput {
  messages: ChatMessage[]
  draft: ChatDraft
  target?: string
  /** new 新经历；event 补一件已有的事；exp 在已有经历里聊新的一件事 */
  mode: 'new' | 'event' | 'exp'
}

export interface InterviewOutput {
  reply: string
  draft: ChatDraft
  /** 信息已经够保存 */
  done: boolean
  quickReplies: string[]
}

/** 导入时拆出的一条：可能是教育背景，也可能是某一类经历 */
export interface ParsedEntry {
  id: string
  category: Category
  /** 为什么分到这个栏目，展示给用户 */
  reason: string
  /** 机构；教育背景时是学校 */
  org: string
  /** 职位；教育背景时是专业 */
  role: string
  degree: string
  employmentType: EmploymentType
  start: string
  end: string
  /** 教育背景的补充说明 */
  details: string
  rawText: string
  items: ParsedItem[]
}

export interface ParsedItem {
  id: string
  lead: string
  text: string
}

export interface ParsedResume {
  contacts: { name: string; phone: string; email: string }
  entries: ParsedEntry[]
  honors: { id: string; title: string; date: string; issuer: string }[]
  skills: { id: string; label: string; items: string[] }[]
}

/** 重写时可以参考的事实；表达里的一切都必须能在这里找到 */
export type RewriteFacts = Pick<Event, 'title' | 'background' | 'action' | 'result' | 'metrics' | 'contribution' | 'signals'>

/** 按岗位调整表达时的目标 */
export interface JobFocus {
  title: string
  company: string
  keywords: string[]
  requirements: string[]
}

/** 这件事所属的经历：让模型知道项目规模、角色和技术栈 */
export interface RewriteContext {
  org: string
  /** 职位和性质，如“后端开发（个人项目）” */
  role: string
  summary: string
  /** 同一经历里其他事的表达，只作背景 */
  siblings: string[]
}

export interface RewriteInput {
  lead: string
  text: string
  facts?: RewriteFacts
  job?: JobFocus
  context?: RewriteContext
}

/** 从经历里挖掘出的能力：标签 + 原文依据 */
export interface Insight {
  label: string
  evidence: string
}

/** 量化维度：已经用上的数字，或者值得补充的数字（附追问） */
export interface MetricHint {
  label: string
  value: string
  status: 'used' | 'missing'
  question: string
  /** 去哪里找这个数字，或者怎么诚实地估算 */
  hint?: string
}

export interface RewriteOutput {
  /** 招聘方扫一眼原文的第一印象 */
  firstLook?: string
  lead: string
  text: string
  insights: Insight[]
  metrics: MetricHint[]
  /** 改了什么、为什么 */
  notes: string[]
  /** 事实里缺的、值得补充的信息 */
  asks: string[]
  /** 由谁完成：DeepSeek 或本地规则 */
  engine?: string
}

/**
 * 所有 AI 任务的统一接口。现在由本地规则实现；
 * 接入真实模型时在服务端实现同样的接口，密钥不进浏览器。
 */
export interface AiProvider {
  name: string
  parseJob(raw: string): Promise<ParsedJob>
  matchRequirements(library: Library, requirements: Requirement[]): Promise<RequirementMatch[]>
  /** 聊一轮：把用户说的话整理进草稿，并给出下一个问题 */
  interview(input: InterviewInput): Promise<InterviewOutput>
  /** 重写一条表达。传入 job 时按岗位调整角度和重点；不得新增事实和数字 */
  rewrite(input: RewriteInput): Promise<RewriteOutput>
  parseResume(text: string): Promise<ParsedResume>
}
