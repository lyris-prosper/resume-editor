import { loadEnv, type Plugin } from 'vite'
import { AiError, chatJSON, type ModelConfig } from './deepseek'
import { INTERVIEW_SYSTEM, PARSE_JOB_SYSTEM, PARSE_RESUME_SYSTEM, REWRITE_SYSTEM, interviewUser, parseJobUser, parseResumeUser, rewriteUser } from './prompts'

/**
 * 本地 AI 服务：浏览器请求 /api/ai/*，这里带上密钥转发给 DeepSeek。
 * 密钥写在项目根目录的 .env.local（DEEPSEEK_API_KEY=…），每次请求都重新读取，改完不用重启。
 */

type Task = 'rewrite' | 'interview' | 'parseResume' | 'parseJob'

const TASKS: Record<Task, { system: string; user: (body: any) => string; temperature: number; maxTokens: number }> = {
  rewrite: { system: REWRITE_SYSTEM, user: rewriteUser, temperature: 0.6, maxTokens: 2048 },
  interview: { system: INTERVIEW_SYSTEM, user: interviewUser, temperature: 0.5, maxTokens: 4096 },
  parseResume: { system: PARSE_RESUME_SYSTEM, user: (b) => parseResumeUser(String(b.text ?? '')), temperature: 0.1, maxTokens: 8192 },
  parseJob: { system: PARSE_JOB_SYSTEM, user: (b) => parseJobUser(String(b.text ?? '')), temperature: 0.1, maxTokens: 4096 },
}

function readConfig(mode: string, root: string): ModelConfig | null {
  const env = loadEnv(mode, root, '')
  const apiKey = (env.DEEPSEEK_API_KEY ?? '').trim()
  if (!apiKey || apiKey.startsWith('sk-在这里')) return null
  const reasoning = (env.DEEPSEEK_REASONING ?? 'none').trim()
  return {
    apiKey,
    baseUrl: (env.DEEPSEEK_BASE_URL ?? '').trim() || 'https://api.deepseek.com',
    model: (env.DEEPSEEK_MODEL ?? '').trim() || 'deepseek-flash',
    reasoning: reasoning === 'low' || reasoning === 'high' ? reasoning : 'none',
  }
}

async function readBody(req: any): Promise<any> {
  let raw = ''
  for await (const chunk of req) {
    raw += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
    if (raw.length > 400_000) throw new AiError('内容太长了，请分段导入', 'upstream')
  }
  return raw ? JSON.parse(raw) : {}
}

function send(res: any, status: number, data: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(data))
}

export function aiPlugin(): Plugin {
  let mode = 'development'
  let root = '.'

  const handle = async (req: any, res: any, next: () => void) => {
    const url: string = req.url ?? ''
    if (!url.startsWith('/api/ai/')) return next()
    const name = url.slice('/api/ai/'.length).split('?')[0]
    const cfg = readConfig(mode, root)

    if (name === 'status') {
      return send(res, 200, { configured: !!cfg, provider: 'DeepSeek', model: cfg?.model ?? null })
    }
    if (req.method !== 'POST' || !(name in TASKS)) return send(res, 404, { ok: false, error: '没有这个接口' })
    if (!cfg) return send(res, 200, { ok: false, code: 'no_key', error: '还没有配置 DeepSeek 密钥' })

    try {
      const body = await readBody(req)
      const task = TASKS[name as Task]
      const started = Date.now()
      const data = await chatJSON(cfg, { system: task.system, user: task.user(body), temperature: task.temperature, maxTokens: task.maxTokens })
      console.log(`[ai] ${name} ${cfg.model} ${Date.now() - started}ms`)
      send(res, 200, { ok: true, data })
    } catch (e) {
      const err = e instanceof AiError ? e : new AiError(e instanceof Error ? e.message : String(e), 'upstream')
      console.warn(`[ai] ${name} 失败：${err.message}`)
      send(res, 200, { ok: false, code: err.code, error: err.message })
    }
  }

  return {
    name: 'shili-ai',
    configResolved(config) {
      mode = config.mode
      root = typeof config.envDir === 'string' ? config.envDir : config.root
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => void handle(req, res, next))
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => void handle(req, res, next))
    },
  }
}
