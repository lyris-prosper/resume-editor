import { create } from 'zustand'
import { mockProvider } from './mock'
import { deflate, guard, scrubNumbers } from './rewrite'
import { toInterview, toParsedJob, toParsedResume, toRewrite } from './wire'
import type { AiProvider, InterviewInput, RewriteInput, RewriteOutput } from './types'

/**
 * 真实模型：浏览器调用本地服务 /api/ai/*（server/aiPlugin.ts），由服务端带上密钥请求 DeepSeek。
 * 没有配置密钥、或者调用失败时，自动改用本地规则，并在页面上提示原因。
 */

export interface AiStatus {
  configured: boolean
  provider: string
  model: string | null
}

export const useAi = create<{ status: AiStatus | null; notice: string | null; setNotice: (n: string | null) => void }>((set) => ({
  status: null,
  notice: null,
  setNotice: (notice) => set({ notice }),
}))

let statusRequest: Promise<AiStatus> | null = null

export function refreshStatus(force = false): Promise<AiStatus> {
  if (!statusRequest || force) {
    statusRequest = fetch('/api/ai/status')
      .then((r) => (r.ok ? (r.json() as Promise<AiStatus>) : { configured: false, provider: 'DeepSeek', model: null }))
      .catch(() => ({ configured: false, provider: 'DeepSeek', model: null }))
      .then((s) => {
        useAi.setState({ status: s })
        return s
      })
  }
  return statusRequest
}

/* 同时最多 3 个请求，“全部重写”时不会一下子打满接口 */
let running = 0
const queue: (() => void)[] = []
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= 3) await new Promise<void>((r) => queue.push(r))
  running++
  try {
    return await fn()
  } finally {
    running--
    queue.shift()?.()
  }
}

class RemoteError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message)
  }
}

async function call(task: string, body: unknown): Promise<unknown> {
  return slot(async () => {
    let res: Response
    try {
      res = await fetch(`/api/ai/${task}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } catch {
      throw new RemoteError('连不上本地 AI 服务', 'network')
    }
    const json = (await res.json().catch(() => null)) as { ok: boolean; data?: unknown; error?: string; code?: string } | null
    if (!json) throw new RemoteError('本地 AI 服务没有响应', 'network')
    if (!json.ok) throw new RemoteError(json.error ?? '调用失败', json.code ?? 'upstream')
    return json.data
  })
}

/** 先试 DeepSeek，不行就用本地规则 */
async function withFallback<T>(task: string, body: unknown, parse: (data: unknown) => T, local: () => Promise<T>): Promise<T> {
  const status = await refreshStatus()
  if (!status.configured) return local()
  try {
    const out = parse(await call(task, body))
    useAi.getState().setNotice(null)
    return out
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (e instanceof RemoteError && e.code === 'no_key') void refreshStatus(true)
    useAi.getState().setNotice(`DeepSeek 暂时用不了：${msg}。这次先用本地规则完成。`)
    return local()
  }
}

function rewriteSources(input: RewriteInput) {
  const f = input.facts
  const c = input.context
  return [input.text, input.lead, f?.action ?? '', f?.result ?? '', f?.background ?? '', f?.title ?? '', f?.contribution ?? '', ...(f?.metrics ?? []), c?.role ?? '', c?.summary ?? '']
}

/** 模型的改写再过一遍：来源里没有的数字一律换成【补充】占位 */
function finishRewrite(out: RewriteOutput, input: RewriteInput): RewriteOutput {
  if (!out.text) throw new RemoteError('模型没有给出改写', 'bad_output')
  const sources = rewriteSources(input)
  const role = deflate(out.text, sources)
  const text = scrubNumbers(role.text, sources)
  const lead = scrubNumbers(deflate(out.lead, sources).text, sources)
  const removed = [...text.removed, ...lead.removed]
  const notes = [...out.notes]
  if (removed.length) notes.push(`「${removed.join('、')}」在事实里找不到，换成了待补充`)
  if (role.removed.length) notes.push(`事实里没写「${role.removed.join('、')}」，改成了更准确的说法`)
  return {
    ...out,
    text: text.text,
    lead: lead.text.replace(/【补充：[^】]*】/g, '').trim() || input.lead,
    // “已用上”的数字也要能在来源里找到
    metrics: out.metrics.filter((m) => m.status === 'missing' || guard(m.value, sources).length === 0),
    notes,
    engine: 'DeepSeek',
  }
}

/** 对话的第一句：接了模型时可以自由讲述；本地规则则一问一答 */
function opener(input: InterviewInput, configured: boolean) {
  const ev = input.draft.events[0]
  if (configured) {
    if (input.mode === 'event') return `我们把「${ev?.title || '这件事'}」补完整。结果怎么样？有没有可以量化的数字，比如人数、份数、次数？`
    if (input.mode === 'exp') return `接着聊「${input.draft.org}」里的另一件事：具体做了什么，结果怎样？`
    if (input.target) return `你想投「${input.target}」。说说和它最相关的一段经历吧：在哪里、什么角色、做了哪些事，想到哪说到哪，我来整理。`
    return '说说你想整理的一段经历吧：在哪里、什么角色、做了哪些事，想到哪说到哪。我来整理成事实，再写成简历上的话。'
  }
  if (input.mode === 'event') return `我们把「${ev?.title || '这件事'}」里还缺的部分补上。`
  if (input.mode === 'exp') return `接着聊「${input.draft.org}」里的另一件事。`
  if (input.target) return `你想投「${input.target}」。先聊一段和它最相关的经历，我每次只问一个问题，答不上来就说“跳过”。`
  return '我们一次聊一段经历、一件事。我每次只问一个问题，答不上来就说“跳过”。'
}

export const remoteProvider: AiProvider = {
  get name() {
    const s = useAi.getState().status
    return s?.configured ? `DeepSeek（${s.model}）` : '本地规则（未配置 DeepSeek 密钥）'
  },

  parseJob: (raw) => withFallback('parseJob', { text: raw }, toParsedJob, () => mockProvider.parseJob(raw)),

  // 要求和经历的对应在本地计算：快、稳定，可以解释命中了哪些词
  matchRequirements: (library, requirements) => mockProvider.matchRequirements(library, requirements),

  async interview(input) {
    const status = await refreshStatus()
    if (input.messages.length === 0) {
      if (status.configured) return { reply: opener(input, true), draft: input.draft, done: false, quickReplies: [] }
      const first = await mockProvider.interview(input)
      return { ...first, reply: `${opener(input, false)}\n${first.reply}` }
    }
    return withFallback(
      'interview',
      { messages: input.messages, draft: { ...input.draft, skipped: undefined }, target: input.target, mode: input.mode },
      (d) => toInterview(d, input.draft),
      () => mockProvider.interview(input),
    )
  },

  rewrite: (input) =>
    withFallback(
      'rewrite',
      { lead: input.lead, text: input.text, facts: input.facts, context: input.context, job: input.job && { title: input.job.title, company: input.job.company, requirements: input.job.requirements } },
      (d) => finishRewrite(toRewrite(d), input),
      () => mockProvider.rewrite(input),
    ),

  parseResume: (text) =>
    withFallback(
      'parseResume',
      { text },
      (d) => {
        const r = toParsedResume(d)
        if (!r.entries.length) throw new RemoteError('模型没有拆出经历', 'bad_output')
        return r
      },
      () => mockProvider.parseResume(text),
    ),
}
