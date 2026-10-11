import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ArrowUp, Check, Loader2, Plus, Sparkles, X } from 'lucide-react'
import { useStore } from '../store/store'
import { ai, useAi } from '../lib/ai'
import { emptyChatDraft, emptyEventDraft } from '../lib/ai/mock'
import type { ChatDraft, ChatEventDraft } from '../lib/ai/types'
import { KIND_LABEL, KIND_ORDER, KIND_TYPES, type Event, type Experience, type ExperienceKind } from '../lib/schema'
import { uid } from '../lib/ids'
import { AutoTextarea } from '../components/ui'
import { TodoText } from '../components/Todo'

interface Message {
  id: string
  from: 'ai' | 'user'
  text: string
}

/** AI 的发言标记 */
function AiMark({ busy }: { busy?: boolean }) {
  return (
    <span className="tile-3d mt-0.5 !rounded-full text-[11px] italic text-ink-2" style={{ width: 28, height: 28 }}>
      {busy ? <Loader2 size={12} className="animate-spin" /> : 'AI'}
    </span>
  )
}

const FIELDS: { key: 'background' | 'action' | 'result' | 'contribution'; label: string }[] = [
  { key: 'background', label: '背景' },
  { key: 'action', label: '行动' },
  { key: 'result', label: '结果' },
  { key: 'contribution', label: '本人' },
]

function EventDraftCard({ ev, index, onChange, onRemove }: { ev: ChatEventDraft; index: number; onChange: (e: ChatEventDraft) => void; onRemove?: () => void }) {
  const set = <K extends keyof ChatEventDraft>(k: K, v: ChatEventDraft[K]) => onChange({ ...ev, [k]: v })
  return (
    <div className="animate-rise rounded-[16px] bg-paper px-4 py-3 shadow-[0_0_0_1px_rgb(17_17_17/0.08)]">
      <div className="flex items-center gap-2">
        <span className="num text-[11.5px] text-ink-4">{index + 1}</span>
        <input className="inline-edit min-w-0 flex-1 text-[15.5px] font-semibold placeholder:font-normal" placeholder="这件事叫什么" value={ev.title} onChange={(e) => set('title', e.target.value)} aria-label="这件事" />
        {onRemove && (
          <button className="text-ink-4 hover:text-ink" onClick={onRemove} aria-label="删去这件事">
            <X size={14} />
          </button>
        )}
      </div>
      <dl className="mt-2 grid grid-cols-[34px_1fr] gap-x-2 gap-y-1 text-[13.5px] leading-[1.7]">
        {FIELDS.map((f) => (
          <div key={f.key} className="contents">
            <dt className="label pt-[2px]">{f.label}</dt>
            <dd>
              <AutoTextarea className="inline-edit w-full" placeholder="还没聊到" value={ev[f.key]} onChange={(e) => set(f.key, e.target.value)} aria-label={f.label} />
            </dd>
          </div>
        ))}
        <dt className="label pt-[2px]">数字</dt>
        <dd>
          <input
            className="inline-edit num w-full"
            placeholder="没有也没关系，不会替你编"
            value={ev.metrics.join('、')}
            onChange={(e) =>
              set(
                'metrics',
                e.target.value.split(/[、,，]/).map((s) => s.trim()).filter((s, i, arr) => s || i === arr.length - 1),
              )
            }
            aria-label="数字"
          />
        </dd>
      </dl>
      {(ev.text || ev.lead) && (
        <div className="mt-2.5 border-t border-rule pt-2.5">
          <p className="mb-1 flex items-center gap-1 text-[11.5px] tracking-[0.06em] text-ink-3">
            <Sparkles size={11} strokeWidth={1.6} />
            写进简历
          </p>
          <p className="text-[13.5px] leading-[1.8]">
            {ev.lead && <strong className="font-semibold">{ev.lead}：</strong>}
            <TodoText text={ev.text} />
          </p>
        </div>
      )}
    </div>
  )
}

export function ChatView({ header }: { header: React.ReactNode }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const library = useStore((s) => s.library)
  const upsertExperience = useStore((s) => s.upsertExperience)
  const upsertEvent = useStore((s) => s.upsertEvent)
  const status = useAi((s) => s.status)

  // 补聊：从已有事件或经历出发
  const patchEvent = library.events.find((e) => e.id === params.get('event'))
  const patchExp = library.experiences.find((x) => x.id === (patchEvent?.experienceId ?? params.get('exp')))
  const target = params.get('target') ?? undefined
  const mode = patchEvent ? 'event' : patchExp ? 'exp' : 'new'

  const initialDraft = (): ChatDraft => {
    const d = emptyChatDraft()
    if (patchExp) Object.assign(d, { org: patchExp.org, role: patchExp.role, kind: patchExp.kind, employmentType: patchExp.employmentType, start: patchExp.start, end: patchExp.end, summary: patchExp.summary })
    if (patchEvent)
      d.events = [
        {
          id: patchEvent.id,
          title: patchEvent.title,
          background: patchEvent.background,
          action: patchEvent.action,
          result: patchEvent.result,
          contribution: patchEvent.contribution,
          metrics: patchEvent.metrics,
          signals: patchEvent.signals,
          lead: patchEvent.variants[0]?.lead ?? '',
          text: patchEvent.variants[0]?.text ?? '',
        },
      ]
    return d
  }

  const [draft, setDraft] = useState<ChatDraft>(initialDraft)
  const [messages, setMessages] = useState<Message[]>([])
  const [quick, setQuick] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [saved, setSaved] = useState<{ expId: string; count: number } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const d = initialDraft()
    setDraft(d)
    setSaved(null)
    setDone(false)
    setMessages([])
    void ai.interview({ messages: [], draft: d, target, mode }).then((t) => {
      setDraft(t.draft)
      setQuick(t.quickReplies)
      setMessages(t.reply.split('\n').map((text) => ({ id: uid('m'), from: 'ai' as const, text })))
    })
  }, [params.get('event'), params.get('exp'), params.get('target')]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy, done])

  const send = async (text: string) => {
    if (!text.trim() || busy) return
    const next = [...messages, { id: uid('m'), from: 'user' as const, text: text.trim() }]
    setMessages(next)
    setInput('')
    setQuick([])
    setBusy(true)
    try {
      const turn = await ai.interview({ messages: next.map(({ from, text }) => ({ from, text })), draft, target, mode })
      setDraft(turn.draft)
      setDone(turn.done)
      setQuick(turn.quickReplies)
      setMessages((m) => [...m, { id: uid('m'), from: 'ai', text: turn.reply }])
    } catch {
      setMessages((m) => [...m, { id: uid('m'), from: 'ai', text: '这一轮没有处理成功，你的回答还在上面，可以再发一次。' }])
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  const events = draft.events.filter((e) => e.title || e.action || e.text)
  const canSave = Boolean(draft.org.trim() && events.some((e) => e.action || e.text))

  const save = async () => {
    const now = Date.now()
    let expId = patchExp?.id
    if (!patchExp) {
      const exp: Experience = {
        id: uid('exp'),
        kind: draft.kind,
        org: draft.org.trim(),
        role: draft.role.trim(),
        employmentType: draft.employmentType,
        start: draft.start,
        end: draft.end,
        summary: draft.summary,
        rawText: messages
          .filter((m) => m.from === 'user')
          .map((m) => m.text)
          .join('\n'),
        version: 1,
        updatedAt: now,
      }
      upsertExperience(exp)
      expId = exp.id
    }
    for (const ev of events) {
      const existing = ev.id ? library.events.find((e) => e.id === ev.id) : undefined
      let lead = ev.lead
      let text = ev.text
      if (!text && !existing?.variants.length) {
        const r = await ai.rewrite({ lead: '', text: '', facts: { ...ev, title: ev.title } })
        lead = r.lead
        text = r.text
      }
      const variants = existing?.variants.length
        ? existing.variants
        : text
          ? [{ id: uid('va'), angle: target ?? '通用', lead, text, origin: 'ai' as const, createdAt: now }]
          : []
      const event: Event = {
        id: existing?.id ?? uid('ev'),
        experienceId: expId!,
        title: ev.title.trim() || ev.action.slice(0, 12),
        background: ev.background,
        action: ev.action,
        result: ev.result,
        metrics: ev.metrics.filter(Boolean),
        signals: ev.signals,
        contribution: ev.contribution,
        evidence: existing?.evidence ?? 'self',
        sourceNote: existing?.sourceNote ?? '和 AI 聊出来的',
        variants,
        version: existing?.version ?? 0,
        updatedAt: now,
      }
      upsertEvent(event)
    }
    setSaved({ expId: expId!, count: events.length })
    setMessages((m) => [...m, { id: uid('m'), from: 'ai', text: `已保存到事实库：「${draft.org}」里的 ${events.length} 件事。可以接着聊另一件事，或者去重写、适配岗位。` }])
  }

  const setEvent = (i: number, e: ChatEventDraft) => setDraft((d) => ({ ...d, events: d.events.map((x, k) => (k === i ? e : x)) }))
  const set = <K extends keyof ChatDraft>(k: K, v: ChatDraft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const remote = status?.configured

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        {header}
        <div ref={scrollRef} className="scroll-thin min-h-0 flex-1 overflow-y-auto px-12">
          <div className="mx-auto max-w-[680px] space-y-6 pb-10 pt-4">
            {messages.map((m) =>
              m.from === 'ai' ? (
                <div key={m.id} className="flex animate-rise gap-4">
                  <AiMark />
                  <p className="max-w-[86%] whitespace-pre-wrap pt-0.5 text-[16px] leading-[1.85]">{m.text}</p>
                </div>
              ) : (
                <div key={m.id} className="flex animate-rise justify-end">
                  <p className="max-w-[78%] whitespace-pre-wrap rounded-[20px] rounded-br-[6px] bg-ink px-4 py-2.5 text-[15px] leading-[1.7] text-paper">{m.text}</p>
                </div>
              ),
            )}
            {busy && (
              <div className="flex items-center gap-4">
                <AiMark busy />
                <span className="text-[13.5px] text-ink-3">{remote ? '正在整理你说的内容…' : ''}</span>
              </div>
            )}
            {done && !saved && !busy && canSave && (
              <div className="flex animate-rise gap-4 pl-11">
                <button className="btn btn-primary btn-sm" onClick={save}>
                  <Check size={13} strokeWidth={2} />
                  保存到事实库
                </button>
                <span className="self-center text-[13px] text-ink-3">也可以继续补充</span>
              </div>
            )}
          </div>
        </div>

        <div className="px-12 pb-8">
          <div className="mx-auto max-w-[680px]">
            {quick.length > 0 && !saved && (
              <div className="mb-3 flex flex-wrap gap-2">
                {quick.map((q) => (
                  <button key={q} className="btn btn-outline btn-sm" onClick={() => send(q)} disabled={busy}>
                    {q}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2 rounded-[22px] border border-rule-2 bg-paper p-2 pl-4 transition-colors focus-within:border-ink">
              <textarea
                ref={inputRef}
                rows={2}
                className="max-h-40 flex-1 resize-none bg-transparent py-1.5 text-[15.5px] leading-[1.7] outline-none"
                placeholder={remote ? '想到什么说什么，长一点也没关系。Enter 发送，Shift + Enter 换行' : '回答上面的问题…  Enter 发送，Shift + Enter 换行'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    void send(input)
                  }
                }}
                aria-label="你的回答"
              />
              <button className="btn btn-primary !size-10 shrink-0 !p-0" disabled={!input.trim() || busy} onClick={() => send(input)} aria-label="发送">
                <ArrowUp size={17} strokeWidth={1.75} />
              </button>
            </div>
            <p className="mt-2 text-center text-[12px] text-ink-4">{remote ? '由 DeepSeek 整理 · 只记录你说过的内容' : '本地规则 · 在 .env.local 配置 DeepSeek 后可以自由讲述'}</p>
          </div>
        </div>
      </div>

      <aside className="flex w-[440px] shrink-0 flex-col border-l border-rule bg-[linear-gradient(180deg,#fafafa,#fff_320px)]">
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-8 pb-6 pt-9">
          <p className="label">{saved ? '已保存到事实库' : '整理结果 · 随对话更新'}</p>
          <input
            className="inline-edit mt-2 w-full text-[24px] font-semibold leading-snug tracking-[0.02em] placeholder:text-ink-4"
            placeholder="机构或项目名称"
            value={draft.org}
            onChange={(e) => set('org', e.target.value)}
            disabled={!!patchExp}
            aria-label="机构"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13.5px] text-ink-2">
            <input className="inline-edit w-[9em]" placeholder="职位或角色" value={draft.role} onChange={(e) => set('role', e.target.value)} disabled={!!patchExp} aria-label="职位" />
            <input className="inline-edit num w-[5.5em]" placeholder="开始" value={draft.start} onChange={(e) => set('start', e.target.value)} disabled={!!patchExp} aria-label="开始" />
            <span className="text-ink-4">–</span>
            <input className="inline-edit num w-[5.5em]" placeholder="结束" value={draft.end} onChange={(e) => set('end', e.target.value)} disabled={!!patchExp} aria-label="结束" />
          </div>
          {!patchExp && (
            <label className="mt-3 flex items-center gap-2 text-[13px] text-ink-3">
              栏目
              <select
                className="select-pill"
                value={draft.kind}
                onChange={(e) => {
                  const kind = e.target.value as ExperienceKind
                  setDraft((d) => ({ ...d, kind, employmentType: KIND_TYPES[kind].includes(d.employmentType) ? d.employmentType : KIND_TYPES[kind][0] }))
                }}
                disabled={!!saved}
              >
                {KIND_ORDER.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="mt-6 flex items-baseline justify-between">
            <span className="label">这段经历里的事</span>
            <button className="inline-flex items-center gap-1 text-[12.5px] text-ink-3 hover:text-ink" onClick={() => setDraft((d) => ({ ...d, events: [...d.events, emptyEventDraft()] }))}>
              <Plus size={12} strokeWidth={1.6} />
              手动加一件
            </button>
          </div>
          <div className="mt-2 space-y-3">
            {draft.events.length === 0 ? (
              <p className="rounded-[16px] px-4 py-6 text-center text-[13.5px] text-ink-4 shadow-[0_0_0_1px_rgb(17_17_17/0.06)]">聊到具体的事，这里会自动整理出来</p>
            ) : (
              draft.events.map((ev, i) => (
                <EventDraftCard
                  key={ev.id ?? i}
                  ev={ev}
                  index={i}
                  onChange={(e) => setEvent(i, e)}
                  onRemove={ev.id ? undefined : () => setDraft((d) => ({ ...d, events: d.events.filter((_, k) => k !== i) }))}
                />
              ))
            )}
          </div>
        </div>

        <div className="border-t border-rule px-8 py-5">
          {saved ? (
            <div className="space-y-2">
              <button className="btn btn-primary w-full" onClick={() => navigate(`/app/rewrite?exp=${saved.expId}`)}>
                去重写这段经历
              </button>
              <div className="flex gap-2">
                <button className="btn btn-outline btn-sm flex-1" onClick={() => navigate(`/app/chat?exp=${saved.expId}`)}>
                  再聊一件事
                </button>
                <button className="btn btn-quiet btn-sm flex-1" onClick={() => navigate(`/app/library/${saved.expId}`)}>
                  在事实库查看
                </button>
              </div>
            </div>
          ) : (
            <>
              <button className="btn btn-primary btn-lg w-full" disabled={!canSave || busy} onClick={save}>
                保存到事实库{events.length > 0 && <span className="num text-[13px] opacity-70">{events.length} 件事</span>}
              </button>
              <p className="mt-2.5 text-center text-[12.5px] text-ink-3">{canSave ? '每一项都可以直接改' : '至少需要机构，以及一件事的具体行动'}</p>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
