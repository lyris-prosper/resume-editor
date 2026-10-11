import { afterEach, describe, expect, it, vi } from 'vitest'
import { AiError, chatJSON, type ModelConfig } from '../../../server/deepseek'
import { REWRITE_SYSTEM, rewriteUser } from '../../../server/prompts'
import { deflate, scrubNumbers } from '../ai/rewrite'
import { toInterview, toParsedResume, toRewrite } from '../ai/wire'
import { emptyChatDraft, interviewLocally } from '../ai/mock'
import { todos, unsupportedNumbers } from '../facts'

const cfg: ModelConfig = { apiKey: 'sk-test', baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash', reasoning: 'none' }

function reply(content: string, status = 200) {
  return new Response(status === 200 ? JSON.stringify({ choices: [{ message: { content } }] }) : content, { status })
}

afterEach(() => vi.unstubAllGlobals())

describe('DeepSeek 调用', () => {
  it('发送 JSON 模式请求并关闭思考，解析返回的 JSON', async () => {
    const fetchMock = vi.fn(async () => reply('{"lead":"a","text":"b"}'))
    vi.stubGlobal('fetch', fetchMock)
    const out = await chatJSON(cfg, { system: 's json', user: 'u' })
    expect(out).toEqual({ lead: 'a', text: 'b' })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.deepseek.com/chat/completions')
    const body = JSON.parse(String(init.body))
    expect(body).toMatchObject({ model: 'deepseek-flash', response_format: { type: 'json_object' }, thinking: { type: 'disabled' } })
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test')
  })

  it('去掉 ```json 包裹；空内容时重试一次', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(reply('')).mockResolvedValueOnce(reply('```json\n{"ok":1}\n```'))
    vi.stubGlobal('fetch', fetchMock)
    expect(await chatJSON(cfg, { system: 's', user: 'u' })).toEqual({ ok: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('把 401、402 翻译成看得懂的错误', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply('unauthorized', 401)))
    await expect(chatJSON(cfg, { system: 's', user: 'u' })).rejects.toMatchObject({ code: 'auth' })
    vi.stubGlobal('fetch', vi.fn(async () => reply('no money', 402)))
    await expect(chatJSON(cfg, { system: 's', user: 'u' })).rejects.toBeInstanceOf(AiError)
  })

  it('模型不认识思考开关时去掉后重发', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(reply('unknown field thinking', 400)).mockResolvedValueOnce(reply('{"x":1}'))
    vi.stubGlobal('fetch', fetchMock)
    expect(await chatJSON(cfg, { system: 's', user: 'u' })).toEqual({ x: 1 })
    const second = JSON.parse(String((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body))
    expect(second.thinking).toBeUndefined()
  })
})

describe('提示词', () => {
  it('重写提示词要求 json、写明不编数字和占位规则', () => {
    expect(REWRITE_SYSTEM).toContain('json')
    expect(REWRITE_SYSTEM).toContain('【补充：')
    expect(REWRITE_SYSTEM).toContain('成果先行')
    expect(REWRITE_SYSTEM).toContain('firstLook')
    const user = rewriteUser({ lead: '数据清洗', text: '清洗问卷', facts: { action: '清洗 312 份问卷', metrics: ['312 份问卷'] }, job: { title: '数据分析实习生', requirements: ['熟悉 SQL'] } })
    expect(user).toContain('【原句】数据清洗：清洗问卷')
    expect(user).toContain('数字：312 份问卷')
    expect(user).toContain('【目标岗位】数据分析实习生')
  })

  it('带上所属经历和同一经历里的其他事', () => {
    const user = rewriteUser({ text: '设计缓存', context: { org: '短链接平台', role: '后端开发（个人项目）', summary: '技术栈：Java / Redis', siblings: ['核心功能：实现短码跳转'] } })
    expect(user).toContain('【所属经历】短链接平台；角色：后端开发（个人项目）；技术栈：Java / Redis')
    expect(user).toContain('- 核心功能：实现短码跳转')
  })
})

describe('模型输出的兜底', () => {
  it('事实里没有的数字换成【补充】占位', () => {
    const r = scrubNumbers('清洗 312 份问卷，效率提升 30%，覆盖 5 个学院', ['对 312 份问卷数据进行了清洗'])
    expect(r.text).toBe('清洗 312 份问卷，效率提升【补充：效率提升幅度】，覆盖【补充：学院数量】学院')
    expect(r.removed).toEqual(['30%', '5 个'])
    expect(todos(r.text)).toEqual(['效率提升幅度', '学院数量'])
  })

  it('事实里没写“独立”“主导”时改回中性说法', () => {
    expect(deflate('独立完成接口设计，主导压测', ['完成接口设计和压测'])).toEqual({ text: '完成接口设计，参与压测', removed: ['独立', '主导'] })
    expect(deflate('独立完成接口设计', ['后端开发（个人项目）']).removed).toEqual([])
    expect(deflate('独立负责归类', ['负责归类，未独立决定方案']).text).toBe('负责归类')
  })

  it('解析出第一印象和找数字的提示', () => {
    const r = toRewrite({ firstLook: '看不出效果', text: '改写', metrics: [{ label: 'QPS', status: 'missing', question: '多少？', hint: '看压测报告' }] })
    expect(r.firstLook).toBe('看不出效果')
    expect(r.metrics[0].hint).toBe('看压测报告')
  })

  it('占位里的说明不算“事实里没有的数字”', () => {
    expect(unsupportedNumbers('处理【补充：报名记录条数】数据', { background: '', action: '', result: '', metrics: [] })).toEqual([])
  })

  it('缺字段、错枚举时补上合理的默认值', () => {
    const r = toRewrite({ text: '改写后', insights: [{ label: '数据分析' }], metrics: [{ label: '规模', status: 'weird' }] })
    expect(r).toMatchObject({ lead: '', text: '改写后', insights: [{ label: '数据分析', evidence: '' }], metrics: [{ status: 'missing' }], notes: [], asks: [] })

    const parsed = toParsedResume({
      entries: [
        { category: 'internship', org: '辉瑞', role: '实习生', items: [{ text: '检索文献' }], start: '2025年6月', end: '2025-08' },
        { category: 'unknown', org: '中国医科大学', role: '药学', rawText: '中国医科大学 药学 本科' },
      ],
    })
    expect(parsed.entries.map((e) => e.category)).toEqual(['internship', 'education'])
    expect(parsed.entries[0]).toMatchObject({ start: '2025.06', end: '2025.08', employmentType: 'internship' })
    expect(parsed.entries[0].items[0].id).toBeTruthy()
  })

  it('对话整理：模型漏掉的字段沿用上一轮，新事件不带假 id', () => {
    const prev = { ...emptyChatDraft(), org: '星野科技', events: [{ id: 'ev_1', title: '访谈', background: '', action: 'a', result: '', contribution: '', metrics: [], signals: [], lead: '', text: '' }] }
    const out = toInterview(
      {
        reply: '好的',
        draft: { org: '', kind: 'research', employmentType: 'internship', events: [{ id: 'ev_1', title: '访谈', action: 'a' }, { id: 'made-up', title: '新的事', action: 'b' }] },
        done: true,
      },
      prev,
    )
    expect(out.draft.org).toBe('星野科技')
    expect(out.draft.employmentType).toBe('research')
    expect(out.draft.events.map((e) => e.id)).toEqual(['ev_1', undefined])
    expect(out.done).toBe(true)
  })
})

describe('本地规则的对话整理', () => {
  it('一问一答填进草稿，信息够了就起草简历表达', () => {
    let draft = emptyChatDraft()
    const messages: { from: 'ai' | 'user'; text: string }[] = []
    const answers = ['星野科技', '产品实习生', '2026.07-2026.09', '用户访谈整理', '要了解学生的真实问题', '整理 12 位同学的访谈记录并按主题归类', '本人负责记录和归类', '归纳出 3 类问题', '12 位同学']
    let out = interviewLocally({ messages, draft, mode: 'new' })
    for (const a of answers) {
      messages.push({ from: 'ai', text: out.reply }, { from: 'user', text: a })
      out = interviewLocally({ messages, draft, mode: 'new' })
      draft = out.draft
    }
    expect(out.done).toBe(true)
    expect(draft).toMatchObject({ org: '星野科技', kind: 'internship', start: '2026.07', end: '2026.09' })
    expect(draft.events[0]).toMatchObject({ title: '用户访谈整理', result: '归纳出 3 类问题' })
    expect(draft.events[0].text).toContain('12 位同学')
  })
})
