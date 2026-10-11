/**
 * DeepSeek 调用（OpenAI 兼容接口）。只在本地服务端运行，密钥不会进入浏览器。
 * 文档：https://api-docs.deepseek.com/
 */

export interface ModelConfig {
  apiKey: string
  baseUrl: string
  model: string
  /** none 关闭思考，响应最快；low / high 质量更高但更慢 */
  reasoning: 'none' | 'low' | 'high'
}

export class AiError extends Error {
  constructor(
    message: string,
    public code: 'no_key' | 'auth' | 'balance' | 'rate' | 'network' | 'bad_output' | 'upstream',
  ) {
    super(message)
  }
}

function explain(status: number, body: string): AiError {
  if (status === 401) return new AiError('DeepSeek 密钥无效，请检查 .env.local 里的 DEEPSEEK_API_KEY', 'auth')
  if (status === 402) return new AiError('DeepSeek 账户余额不足', 'balance')
  if (status === 429) return new AiError('请求太频繁，稍等几秒再试', 'rate')
  return new AiError(`DeepSeek 返回错误 ${status}：${body.slice(0, 160)}`, 'upstream')
}

/** 去掉偶尔出现的 ```json 包裹 */
function parseJson(content: string) {
  const trimmed = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  return JSON.parse(trimmed)
}

export async function chatJSON(
  cfg: ModelConfig,
  opts: { system: string; user: string; temperature?: number; maxTokens?: number; timeoutMs?: number },
): Promise<unknown> {
  const base = {
    model: cfg.model,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
    response_format: { type: 'json_object' },
    max_tokens: opts.maxTokens ?? 4096,
    stream: false,
  } as Record<string, unknown>
  if (cfg.reasoning === 'none') {
    base.thinking = { type: 'disabled' }
    base.temperature = opts.temperature ?? 0.5
  } else base.reasoning_effort = cfg.reasoning

  const send = async (body: Record<string, unknown>) => {
    let res: Response
    try {
      res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 90_000),
      })
    } catch (e) {
      const timeout = e instanceof Error && e.name === 'TimeoutError'
      throw new AiError(timeout ? 'DeepSeek 响应超时，请再试一次' : '连不上 DeepSeek，请检查网络', 'network')
    }
    const text = await res.text()
    if (!res.ok) return { error: explain(res.status, text), status: res.status }
    const data = JSON.parse(text) as { choices?: { message?: { content?: string } }[] }
    return { content: data.choices?.[0]?.message?.content ?? '' }
  }

  let r = await send(base)
  // 个别模型不认识思考开关时，去掉后重发
  if ('error' in r && r.status === 400 && /thinking|reasoning/i.test(r.error.message)) {
    const { thinking: _t, reasoning_effort: _r, ...rest } = base
    r = await send(rest)
  }
  if ('error' in r) throw r.error

  // JSON 模式偶尔返回空内容或不完整的 JSON：再试一次
  for (let attempt = 0; attempt < 2; attempt++) {
    if (r.content.trim()) {
      try {
        return parseJson(r.content)
      } catch {
        /* 重试 */
      }
    }
    if (attempt === 0) {
      const again = await send(base)
      if ('error' in again) throw again.error
      r = again
    }
  }
  throw new AiError('模型没有返回有效的结果，请再试一次', 'bad_output')
}
