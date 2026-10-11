import { useState } from 'react'
import { Plus, Sparkles, X } from 'lucide-react'
import { useNavigate } from 'react-router'
import type { Event, Variant } from '../lib/schema'
import { useStore } from '../store/store'
import { uid } from '../lib/ids'
import { relativeTime } from '../lib/format'
import { AutoTextarea, Field, TextButton } from '../components/ui'
import { RewriteCard } from './RewriteCard'
import { TodoText } from '../components/Todo'

const FACTS: { key: 'background' | 'action' | 'result'; label: string }[] = [
  { key: 'background', label: '背景' },
  { key: 'action', label: '行动' },
  { key: 'result', label: '结果' },
]

const splitList = (v: string) =>
  v
    .split(/[、,，]/)
    .map((s) => s.trim())
    .filter(Boolean)

function EventEditor({ event, onDone }: { event: Event; onDone: () => void }) {
  const upsertEvent = useStore((s) => s.upsertEvent)
  const [d, setD] = useState(event)
  const set = <K extends keyof Event>(k: K, v: Event[K]) => setD((x) => ({ ...x, [k]: v }))

  return (
    <div className="space-y-5">
      <Field label="这件事叫什么">
        <input className="input-line text-[18px] font-semibold" value={d.title} onChange={(e) => set('title', e.target.value)} autoFocus={!d.title} />
      </Field>
      {FACTS.map((f) => (
        <Field key={f.key} label={f.label}>
          <AutoTextarea className="input-line" value={d[f.key]} onChange={(e) => set(f.key, e.target.value)} />
        </Field>
      ))}
      <div className="grid grid-cols-2 gap-6">
        <Field label="数字证据" hint="用顿号分隔">
          <input className="input-line num" value={d.metrics.join('、')} onChange={(e) => set('metrics', splitList(e.target.value))} />
        </Field>
        <Field label="能力" hint="用顿号分隔">
          <input className="input-line" value={d.signals.join('、')} onChange={(e) => set('signals', splitList(e.target.value))} />
        </Field>
      </div>
      <Field label="本人贡献" hint="写清个人和团队的边界">
        <input className="input-line" value={d.contribution} onChange={(e) => set('contribution', e.target.value)} />
      </Field>
      <div className="grid grid-cols-[150px_1fr] gap-6">
        <Field label="证据">
          <select className="input-line" value={d.evidence} onChange={(e) => set('evidence', e.target.value as Event['evidence'])}>
            <option value="self">仅自述</option>
            <option value="attached">附有材料</option>
          </select>
        </Field>
        <Field label="材料说明">
          <input className="input-line" placeholder="例如：访谈记录文档、作品链接" value={d.sourceNote} onChange={(e) => set('sourceNote', e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button className="btn btn-quiet btn-sm" onClick={onDone}>
          取消
        </button>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            upsertEvent(d)
            onDone()
          }}
        >
          保存
        </button>
      </div>
    </div>
  )
}

/** 简历表达：同一件事面向不同岗位的写法 */
function Expressions({ event }: { event: Event }) {
  const navigate = useNavigate()
  const upsertEvent = useStore((s) => s.upsertEvent)
  const applyRewrite = useStore((s) => s.applyRewrite)
  const addMetrics = useStore((s) => s.addMetrics)
  const [activeId, setActiveId] = useState(event.variants[0]?.id)
  const [editing, setEditing] = useState<Variant | null>(null)
  const [rewriting, setRewriting] = useState(false)
  const active = event.variants.find((v) => v.id === activeId) ?? event.variants[0]

  const save = (v: Variant) => {
    const exists = event.variants.some((x) => x.id === v.id)
    upsertEvent({ ...event, variants: exists ? event.variants.map((x) => (x.id === v.id ? v : x)) : [...event.variants, v] })
    setActiveId(v.id)
    setEditing(null)
  }

  const addAngle = () => setEditing({ id: uid('va'), angle: '', lead: active?.lead ?? event.title, text: active?.text ?? '', origin: 'user', createdAt: Date.now() })

  return (
    <div className="mt-7">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="label">简历表达</span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1" role="tablist">
          {event.variants.map((v) => {
            const on = v.id === active?.id
            return (
              <button
                key={v.id}
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setActiveId(v.id)
                  setEditing(null)
                  setRewriting(false)
                }}
                className={`relative pb-0.5 text-[14px] transition-colors ${on ? 'text-ink' : 'text-ink-3 hover:text-ink'}`}
              >
                {v.angle || '未命名'}
                {v.origin === 'ai' && <Sparkles size={10} strokeWidth={1.8} className="ml-0.5 inline -translate-y-1 text-ink-3" aria-label="AI 重写后采纳" />}
                {on && <span className="absolute inset-x-0 -bottom-px h-px bg-ink" />}
              </button>
            )
          })}
          <button className="inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink" onClick={addAngle}>
            <Plus size={13} strokeWidth={1.5} />
            新角度
          </button>
        </div>
      </div>

      {editing ? (
        <div className="mt-4 space-y-4 border-l-2 border-ink pl-5">
          <div className="grid grid-cols-[1fr_140px] gap-6">
            <Field label="概括短语">
              <input className="input-line font-semibold" value={editing.lead} onChange={(e) => setEditing({ ...editing, lead: e.target.value })} />
            </Field>
            <Field label="角度">
              <input className="input-line" placeholder="如：产品、运营" value={editing.angle} onChange={(e) => setEditing({ ...editing, angle: e.target.value })} autoFocus={!editing.angle} />
            </Field>
          </div>
          <Field label="写进简历的一句话" hint="只能重组已有事实，不新增数字或职责">
            <AutoTextarea className="input-line" value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2">
            <button className="btn btn-quiet btn-sm" onClick={() => setEditing(null)}>
              取消
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => save({ ...editing, angle: editing.angle.trim() || '自定义', origin: 'user' })}>
              保存
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 border-l-2 border-ink pl-5">
          {active ? (
            <p className="text-[16px] leading-[1.85]">
              {active.lead && <strong className="font-semibold">{active.lead}：</strong>}
              <TodoText text={active.text} />
            </p>
          ) : (
            <p className="text-[14px] text-ink-3">还没有写进简历的一句话。让 AI 按事实起草一条，或者点“新角度”自己写。</p>
          )}
          {rewriting ? (
            <div className="mt-4">
              <RewriteCard
                compact
                lead={active?.lead ?? ''}
                text={active?.text ?? ''}
                facts={event}
                autoRun
                onClose={() => setRewriting(false)}
                onFacts={(m) => addMetrics(event.id, m)}
                onAsk={() => navigate(`/app/chat?event=${event.id}`)}
                onApply={(lead, text) => {
                  const id = applyRewrite(event.id, { variantId: active?.id, angle: active?.angle ?? '通用', lead, text })
                  if (id) setActiveId(id)
                }}
              />
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-4">
              <button className="inline-flex items-center gap-1 text-[13px] text-ink hover:underline" onClick={() => setRewriting(true)}>
                <Sparkles size={13} strokeWidth={1.6} />
                AI 重写
              </button>
              {active && <TextButton onClick={() => setEditing(active)}>手动改写</TextButton>}
              {active && event.variants.length > 1 && (
                <TextButton onClick={() => confirm(`删除“${active.angle}”这种写法？`) && upsertEvent({ ...event, variants: event.variants.filter((v) => v.id !== active.id) })}>
                  删除这个角度
                </TextButton>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function History({ event }: { event: Event }) {
  const history = useStore((s) => s.eventHistory[event.id] ?? [])
  const restore = useStore((s) => s.restoreEventVersion)
  if (history.length === 0) return <p className="text-[13px] text-ink-3">还没有历史版本。</p>
  return (
    <ul className="divide-y divide-rule">
      {[...history].reverse().map((h) => (
        <li key={`${h.version}-${h.updatedAt}`} className="flex items-center gap-4 py-2 text-[13px]">
          <span className="num w-8 text-ink-3">v{h.version}</span>
          <span className="flex-1 truncate text-ink-2">{h.variants[0]?.text || h.action || h.title}</span>
          <span className="num text-ink-3">{relativeTime(h.updatedAt)}</span>
          <TextButton onClick={() => restore(event.id, h.version)}>恢复</TextButton>
        </li>
      ))}
    </ul>
  )
}

/** 一件事：像一页文档里的一节，事实在上，简历表达在下 */
export function EventSection({ event }: { event: Event }) {
  const deleteEvent = useStore((s) => s.deleteEvent)
  const navigate = useNavigate()
  const [editing, setEditing] = useState(event.title === '' && event.action === '')
  const [showHistory, setShowHistory] = useState(false)
  const missing = [!event.result && '结果', !event.contribution && '本人贡献'].filter(Boolean) as string[]

  return (
    <article className="animate-rise border-t border-rule py-10 first:border-t-0 first:pt-2">
      {editing ? (
        <EventEditor event={event} onDone={() => setEditing(false)} />
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="text-[21px] font-semibold leading-snug tracking-[0.02em]">{event.title || '未命名的事'}</h3>
            <button className="shrink-0 text-ink-4 transition-colors hover:text-ink" onClick={() => confirm(`删除“${event.title}”？已生成的简历不受影响。`) && deleteEvent(event.id)} aria-label="删除这件事">
              <X size={15} />
            </button>
          </div>
          <p className="mt-1 text-[12.5px] text-ink-3">
            <span className="num">v{event.version}</span>
            <span className="mx-2">·</span>
            {event.evidence === 'attached' ? `附有材料${event.sourceNote ? `：${event.sourceNote}` : ''}` : '仅自述'}
          </p>

          <dl className="mt-5 grid grid-cols-[44px_1fr] gap-x-4 gap-y-2.5 text-[15px] leading-[1.8]">
            {FACTS.map((f) => (
              <div key={f.key} className="contents">
                <dt className="label pt-[3px]">{f.label}</dt>
                <dd className={event[f.key] ? '' : 'text-ink-4'}>{event[f.key] || '还没有记录'}</dd>
              </div>
            ))}
            {event.metrics.length > 0 && (
              <div className="contents">
                <dt className="label pt-[3px]">数字</dt>
                <dd className="num flex flex-wrap gap-x-5">
                  {event.metrics.map((m) => (
                    <span key={m} className="underline decoration-rule-2 underline-offset-4">
                      {m}
                    </span>
                  ))}
                </dd>
              </div>
            )}
            {event.contribution && (
              <div className="contents">
                <dt className="label pt-[3px]">本人</dt>
                <dd className="text-ink-2">{event.contribution}</dd>
              </div>
            )}
            {event.signals.length > 0 && (
              <div className="contents">
                <dt className="label pt-[3px]">能力</dt>
                <dd className="text-ink-2">{event.signals.join('、')}</dd>
              </div>
            )}
          </dl>

          {missing.length > 0 && (
            <p className="mt-5 text-[14px] text-ink-3">
              还缺{missing.join('、')}，补上后重写会更有力。
              <button className="link ml-1 text-ink" onClick={() => navigate(`/app/chat?event=${event.id}`)}>
                和 AI 补聊
              </button>
            </p>
          )}

          <Expressions event={event} />

          <div className="mt-6 flex items-center gap-5">
            <TextButton onClick={() => setEditing(true)}>编辑事实</TextButton>
            <TextButton onClick={() => navigate(`/app/chat?event=${event.id}`)}>补聊</TextButton>
            <TextButton onClick={() => setShowHistory((v) => !v)}>{showHistory ? '收起历史' : '历史版本'}</TextButton>
          </div>
          {showHistory && (
            <div className="mt-3 border-t border-rule pt-2">
              <History event={event} />
            </div>
          )}
        </>
      )}
    </article>
  )
}
