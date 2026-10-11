import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, CircleDashed, CornerUpLeft, Loader2, PenLine, Sparkles } from 'lucide-react'
import { ai } from '../lib/ai'
import type { Insight, JobFocus, MetricHint, RewriteContext, RewriteFacts, RewriteOutput } from '../lib/ai/types'
import { useStore } from '../store/store'
import { roleLine } from '../lib/format'
import { compose, diffSegments, hunks, type Decision } from '../lib/diff'
import { unsupportedNumbers } from '../lib/facts'
import { DiffLegend, DiffView } from '../components/Diff'
import { FillGaps, TodoText } from '../components/Todo'
import { AutoTextarea } from '../components/ui'

/** 所属经历和同一经历里的其他事：让模型知道项目规模、角色和技术栈 */
function contextFor(facts?: { id?: string; experienceId?: string }): RewriteContext | undefined {
  if (!facts?.experienceId) return undefined
  const { experiences, events } = useStore.getState().library
  const exp = experiences.find((e) => e.id === facts.experienceId)
  if (!exp) return undefined
  const stack = exp.rawText.match(/(?:技术栈|技术选型|工具)[:：][^\n]{2,80}/)?.[0] ?? ''
  return {
    org: exp.org,
    role: roleLine(exp),
    summary: [exp.summary, stack].filter(Boolean).join('；'),
    siblings: events
      .filter((e) => e.experienceId === exp.id && e.id !== facts.id)
      .map((e) => {
        const v = e.variants[0]
        return v ? `${v.lead ? `${v.lead}：` : ''}${v.text}` : [e.title, e.action].filter(Boolean).join('：')
      })
      .filter(Boolean),
  }
}

const NO_FACTS: RewriteFacts = { title: '', background: '', action: '', result: '', metrics: [], contribution: '', signals: [] }

export type RewriteState = 'idle' | 'running' | 'review' | 'editing' | 'done'

interface Props {
  lead: string
  text: string
  /** 传入完整的事件时，会带上所属经历作为背景 */
  facts?: RewriteFacts & { id?: string; experienceId?: string }
  job?: JobFocus
  /** 采纳后写回；返回值不用 */
  onApply: (lead: string, text: string) => void
  /** 每次变化（> 0）时，空闲的卡片自动开始重写，用于“全部重写” */
  runToken?: number
  /** 打开时立即重写 */
  autoRun?: boolean
  onState?: (s: RewriteState) => void
  onInsights?: (insights: Insight[]) => void
  /** 事实缺口：点“补充”时跳转 */
  onAsk?: () => void
  /** 用户补上的数字，记进事实 */
  onFacts?: (metrics: string[]) => void
  /** 紧凑：嵌在事实库或编辑器里，不显示原文 */
  compact?: boolean
  /** 嵌入时可以收起 */
  onClose?: () => void
  emptyHint?: ReactNode
}

/** 一条表达的重写：原文 → AI 建议（逐处标注）→ 采纳 / 保留 / 继续编辑 */
export function RewriteCard({ lead, text, facts, job, onApply, runToken = 0, autoRun, onState, onInsights, onAsk, onFacts, compact, onClose, emptyHint }: Props) {
  const [state, setStateRaw] = useState<RewriteState>('idle')
  const [result, setResult] = useState<RewriteOutput | null>(null)
  const [decisions, setDecisions] = useState<Record<number, Decision>>({})
  const [leadDecisions, setLeadDecisions] = useState<Record<number, Decision>>({})
  const [draft, setDraft] = useState({ lead: '', text: '' })
  const [undo, setUndo] = useState<{ lead: string; text: string } | null>(null)
  const lastToken = useRef(runToken)

  const setState = (s: RewriteState) => {
    setStateRaw(s)
    onState?.(s)
  }

  /** extra：用户刚补上的数字，和事实一起交给模型 */
  const run = async (extra: string[] = []) => {
    setState('running')
    setDecisions({})
    setLeadDecisions({})
    const withExtra = extra.length ? { ...(facts ?? NO_FACTS), metrics: [...new Set([...(facts?.metrics ?? []), ...extra])] } : facts
    try {
      const r = await ai.rewrite({ lead, text, facts: withExtra, job, context: contextFor(facts) })
      setResult(r)
      onInsights?.(r.insights)
      setState('review')
    } catch {
      setState('idle')
    }
  }

  useEffect(() => {
    if (runToken > lastToken.current && (state === 'idle' || state === 'done')) void run()
    lastToken.current = runToken
  }, [runToken]) // eslint-disable-line react-hooks/exhaustive-deps

  const started = useRef(false)
  useEffect(() => {
    if (autoRun && !started.current) {
      started.current = true
      void run()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const textSegs = useMemo(() => (result ? diffSegments(text, result.text) : []), [text, result])
  const leadSegs = useMemo(() => (result ? diffSegments(lead, result.lead) : []), [lead, result])
  const all = [...hunks(textSegs), ...hunks(leadSegs)]
  const unchanged = result !== null && all.length === 0
  const rejected = Object.values(decisions).filter((d) => d === 'reject').length + Object.values(leadDecisions).filter((d) => d === 'reject').length

  const finalLead = compose(leadSegs, leadDecisions, 'accept')
  const finalText = compose(textSegs, decisions, 'accept')

  const apply = (l: string, t: string) => {
    setUndo({ lead, text })
    onApply(l, t)
    setState('done')
  }

  const extra = facts ? unsupportedNumbers(`${draft.lead} ${draft.text}`, facts) : []

  /* ---------- 视图 ---------- */

  if (state === 'editing') {
    return (
      <Shell compact={compact}>
        <input
          className="inline-edit w-full text-[15.5px] font-semibold"
          placeholder="概括短语（可以留空）"
          value={draft.lead}
          onChange={(e) => setDraft({ ...draft, lead: e.target.value })}
          aria-label="概括短语"
        />
        <AutoTextarea
          autoFocus
          className="inline-edit mt-1 w-full text-[15.5px] leading-[1.85]"
          value={draft.text}
          onChange={(e) => setDraft({ ...draft, text: e.target.value })}
          aria-label="表达"
        />
        {extra.length > 0 && (
          <p className="mt-2 text-[13px] text-alert">
            事实里没有 <span className="num font-semibold">{extra.join('、')}</span>，请确认数字来源
          </p>
        )}
        <div className="mt-4 flex items-center gap-2">
          <button className="btn btn-primary btn-sm" onClick={() => apply(draft.lead.trim(), draft.text.trim())} disabled={!draft.text.trim()}>
            保存
          </button>
          <button className="btn btn-quiet btn-sm" onClick={() => setState(result ? 'review' : 'idle')}>
            取消
          </button>
        </div>
      </Shell>
    )
  }

  if (state === 'review' && result) {
    return (
      <Shell compact={compact} active>
        <div className="mb-3 flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 text-[12.5px] tracking-[0.06em] text-ink-2">
            <Sparkles size={13} strokeWidth={1.6} />
            {unchanged ? 'AI 看过了' : `${all.length} 处修改`}
            {job && <span className="text-ink-3">· 按「{job.title || '目标岗位'}」</span>}
            {result.engine && <span className="text-ink-4">· {result.engine}</span>}
          </span>
          {!unchanged && <DiffLegend />}
        </div>

        {result.firstLook && (
          <p className="mb-3 text-[13px] leading-relaxed text-ink-3">
            <span className="label mr-2">招聘方第一眼</span>
            {result.firstLook}
          </p>
        )}

        {leadSegs.length > 0 && (lead || result.lead) && (
          <DiffView className="text-[15.5px] font-semibold leading-[1.85]" segments={leadSegs} decisions={leadDecisions} onDecide={(id, d) => setLeadDecisions((x) => decide(x, id, d))} />
        )}
        <DiffView className="text-[15.5px] leading-[1.95]" segments={textSegs} decisions={decisions} onDecide={(id, d) => setDecisions((x) => decide(x, id, d))} />

        <Quantify
          key={result.text}
          metrics={result.metrics.filter((m) => m.status === 'missing')}
          onRerun={(added) => {
            onFacts?.(added)
            void run(added)
          }}
        />

        <Findings result={result} onAsk={onAsk} />

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {unchanged ? (
            <button className="btn btn-outline btn-sm" onClick={() => setState('idle')}>
              好的
            </button>
          ) : (
            <>
              <button className="btn btn-primary btn-sm" onClick={() => apply(finalLead.trim(), finalText.trim())}>
                <Check size={13} strokeWidth={2} />
                {rejected ? `采纳其余 ${all.length - rejected} 处` : '全部采纳'}
              </button>
              <button className="btn btn-quiet btn-sm" onClick={() => setState('idle')}>
                保留原文
              </button>
              <button
                className="btn btn-quiet btn-sm"
                onClick={() => {
                  setDraft({ lead: finalLead, text: finalText })
                  setState('editing')
                }}
              >
                <PenLine size={13} strokeWidth={1.6} />
                继续编辑
              </button>
            </>
          )}
          <span className="ml-auto hidden text-[12px] text-ink-4 md:inline">{unchanged ? '' : '指向某处修改，可以单独采纳或保留'}</span>
        </div>
      </Shell>
    )
  }

  return (
    <Shell compact={compact}>
      {!compact &&
        (text || lead ? (
          <p className={`text-[15.5px] leading-[1.9] ${state === 'running' ? 'animate-pulse text-ink-3' : state === 'done' ? 'text-ink' : 'text-ink-2'}`}>
            {lead && <strong className="font-semibold text-ink">{lead}：</strong>}
            <TodoText text={text} />
          </p>
        ) : (
          <p className="text-[14.5px] text-ink-3">{emptyHint ?? '还没有写进简历的一句话，AI 会根据事实起草。'}</p>
        ))}
      <div className={`${compact ? '' : 'mt-3'} flex flex-wrap items-center gap-x-4 gap-y-2`}>
        <button className="btn btn-outline btn-sm" onClick={() => void run()} disabled={state === 'running'}>
          {state === 'running' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} strokeWidth={1.6} />}
          {state === 'running' ? '正在重写' : state === 'done' ? '再改一次' : job ? '按岗位调整' : 'AI 重写'}
        </button>
        {state === 'done' && (
          <span className="inline-flex items-center gap-3 text-[13px] text-ink-3">
            <span className="inline-flex items-center gap-1 text-ink-2">
              <Check size={13} strokeWidth={2} />
              已更新
            </span>
            {undo && (
              <button
                className="inline-flex items-center gap-1 hover:text-ink"
                onClick={() => {
                  onApply(undo.lead, undo.text)
                  setUndo(null)
                  setState('idle')
                }}
              >
                <CornerUpLeft size={12} strokeWidth={1.6} />
                撤销
              </button>
            )}
          </span>
        )}
        {onClose && state !== 'running' && (
          <button className="text-[13px] text-ink-3 hover:text-ink" onClick={onClose}>
            收起
          </button>
        )}
      </div>
      {state !== 'running' && (
        <FillGaps
          key={text}
          text={text}
          onFill={(next, added) => {
            onApply(lead, next)
            if (added.length) onFacts?.(added)
          }}
        />
      )}
    </Shell>
  )
}

function decide<T extends Record<number, Decision>>(x: T, id: number, d: Decision | undefined) {
  const next = { ...x }
  if (d) next[id] = d
  else delete next[id]
  return next
}

function Shell({ children, compact, active }: { children: ReactNode; compact?: boolean; active?: boolean }) {
  if (compact && !active) return <div>{children}</div>
  return <div className={active ? 'animate-fade rounded-[18px] bg-paper px-5 py-4 shadow-[0_0_0_1px_rgb(17_17_17/0.07),0_14px_34px_-20px_rgb(17_17_17/0.28)]' : ''}>{children}</div>
}

/** 改了什么、体现了什么能力、还可以补充什么 */
function Findings({ result, onAsk }: { result: RewriteOutput; onAsk?: () => void }) {
  const notes = result.notes.filter(Boolean)
  return (
    <div className="mt-4 space-y-3 border-t border-rule pt-3.5 text-[13px] leading-[1.75]">
      {result.insights.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1.5">
          <span className="label mr-1">体现了</span>
          {result.insights.map((i) => (
            <span key={i.label} className="inline-flex items-baseline gap-1.5 rounded-full bg-mist px-2.5 py-0.5" title={`依据：${i.evidence}`}>
              <span className="text-ink">{i.label}</span>
              <span className="max-w-[16em] truncate text-[12px] text-ink-3">{i.evidence}</span>
            </span>
          ))}
        </div>
      )}
      {result.metrics.some((m) => m.status === 'used') && (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1.5">
          <span className="label mr-1">用上的数字</span>
          {result.metrics
            .filter((m) => m.status === 'used')
            .map((m) => (
              <span key={m.label + m.value} className="inline-flex items-center gap-1 rounded-full bg-mist px-2.5 py-0.5">
                <Check size={11} strokeWidth={2.4} className="text-ink-2" />
                <span className="num text-ink">{m.value || m.label}</span>
              </span>
            ))}
        </div>
      )}
      {notes.length > 0 && (
        <ul className="space-y-0.5 text-ink-2">
          {notes.map((n) => (
            <li key={n} className="flex gap-2">
              <span className="mt-[0.7em] h-px w-2.5 shrink-0 bg-ink-4" aria-hidden />
              {n}
            </li>
          ))}
        </ul>
      )}
      {result.asks.length > 0 && (
        <p className="text-ink-3">
          还可以补充：{result.asks.join(' ')}
          {onAsk && (
            <button className="link ml-2 text-ink" onClick={onAsk}>
              补充事实
            </button>
          )}
        </p>
      )}
    </div>
  )
}

/**
 * 量化追问：每个缺的数字一行，写清去哪里找、怎么诚实估算。
 * 填好后记进事实，再让 AI 用真实数字写一版。
 */
function Quantify({ metrics, onRerun }: { metrics: MetricHint[]; onRerun: (added: string[]) => void }) {
  const [values, setValues] = useState<Record<string, string>>({})
  if (!metrics.length) return null
  const added = metrics.filter((m) => values[m.label]?.trim()).map((m) => `${m.label}：${values[m.label].trim()}`)
  return (
    <div className="mt-4 rounded-[14px] bg-alert-wash/70 px-4 py-3.5">
      <p className="flex items-center gap-1.5 text-[13px] text-alert">
        <CircleDashed size={13} strokeWidth={2} />
        补上数字，这条才有说服力。没有精确值时，写诚实的约数或区间
      </p>
      <ul className="mt-3 space-y-3">
        {metrics.map((m) => (
          <li key={m.label}>
            <label className="block text-[13.5px] text-ink" htmlFor={`q-${m.label}`}>
              {m.question || m.label}
            </label>
            {m.hint && <p className="mt-0.5 text-[12.5px] text-ink-3">{m.hint}</p>}
            <input
              id={`q-${m.label}`}
              className="input-line num mt-1 w-full !py-1 text-[13.5px]"
              placeholder={`${m.label}，如 约 1200 / 80~120 ms`}
              value={values[m.label] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [m.label]: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && added.length && onRerun(added)}
            />
          </li>
        ))}
      </ul>
      <button className="btn btn-primary btn-sm mt-3.5" disabled={!added.length} onClick={() => onRerun(added)}>
        <Sparkles size={13} strokeWidth={1.6} />
        用这些数字再写一版
      </button>
    </div>
  )
}
