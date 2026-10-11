import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ArrowRight, Check, Plus, Sparkles, X } from 'lucide-react'
import { useStore } from '../store/store'
import { KIND_LABEL, KIND_ORDER, type Event, type Experience } from '../lib/schema'
import type { Insight, JobFocus } from '../lib/ai/types'
import { jobKeywords } from '../lib/ai/rewrite'
import { byTimeDesc, dateRange, roleLine } from '../lib/format'
import { RewriteCard, type RewriteState } from '../board/RewriteCard'

function ordered(exps: Experience[]) {
  return KIND_ORDER.flatMap((k) =>
    byTimeDesc(
      exps.filter((e) => e.kind === k),
      (e) => e,
    ),
  )
}

/** 选择要重写的经历 */
function Picker() {
  const experiences = useStore((s) => s.library.experiences)
  const events = useStore((s) => s.library.events)
  const navigate = useNavigate()
  const list = ordered(experiences)
  const [picked, setPicked] = useState<Set<string>>(new Set(list.map((e) => e.id)))
  if (list.length === 0) {
    return (
      <div className="mx-auto flex max-w-[520px] flex-col items-center px-8 pt-28 text-center">
        <h1 className="text-[30px] font-semibold tracking-[0.04em]">先放一些经历进来</h1>
        <p className="mt-3 text-[15px] text-ink-2">上传旧简历，或者和 AI 聊一段，再回来重写。</p>
        <div className="mt-8 flex gap-3">
          <Link to="/app/import" className="btn btn-primary">
            导入简历
          </Link>
          <Link to="/app/chat" className="btn btn-outline">
            和 AI 聊一段
          </Link>
        </div>
      </div>
    )
  }
  return (
    <div className="mx-auto max-w-[680px] px-8 pb-24 pt-12">
      <p className="label">经历重写</p>
      <h1 className="mt-1.5 text-[32px] font-semibold tracking-[0.04em]">选择要重写的经历</h1>
      <ul className="mt-8 divide-y divide-rule border-y border-rule">
        {list.map((exp) => {
          const on = picked.has(exp.id)
          return (
            <li key={exp.id}>
              <button
                className="flex w-full items-center gap-4 py-3.5 text-left"
                onClick={() =>
                  setPicked((p) => {
                    const n = new Set(p)
                    if (n.has(exp.id)) n.delete(exp.id)
                    else n.add(exp.id)
                    return n
                  })
                }
                aria-pressed={on}
              >
                <span className={`grid size-5 shrink-0 place-items-center rounded-full border ${on ? 'border-ink bg-ink text-paper' : 'border-rule-2'}`}>{on && <Check size={12} strokeWidth={2.5} />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px]">{exp.org || '未命名经历'}</span>
                  <span className="text-[13px] text-ink-3">
                    {KIND_LABEL[exp.kind]} · <span className="num">{events.filter((e) => e.experienceId === exp.id).length}</span> 件事
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <button className="btn btn-primary mt-8" disabled={!picked.size} onClick={() => navigate(`/app/rewrite?exp=${[...picked].join(',')}`)}>
        开始重写
        <ArrowRight size={15} strokeWidth={1.6} />
      </button>
    </div>
  )
}

function EventRewrite({
  event,
  job,
  focus,
  runToken,
  onState,
  onInsights,
}: {
  event: Event
  job?: { id: string; title: string }
  focus?: JobFocus
  runToken: number
  onState: (s: RewriteState) => void
  onInsights: (i: Insight[]) => void
}) {
  const applyRewrite = useStore((s) => s.applyRewrite)
  const addMetrics = useStore((s) => s.addMetrics)
  const pickForJob = useStore((s) => s.pickForJob)
  const navigate = useNavigate()
  // 按岗位重写时写进以岗位命名的表达；通用重写改的是主表达
  const angle = job ? job.title || '岗位定制' : (event.variants[0]?.angle ?? '通用')
  const base = job ? (event.variants.find((v) => v.angle === angle) ?? event.variants[0]) : event.variants[0]
  const targetId = job ? event.variants.find((v) => v.angle === angle)?.id : event.variants[0]?.id
  return (
    <article className="border-t border-rule py-8 first:border-t-0 first:pt-2">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h3 className="text-[18px] font-semibold tracking-[0.02em]">{event.title || '未命名的事'}</h3>
        <Link to={`/app/library/${event.experienceId}`} className="shrink-0 text-[12.5px] text-ink-3 hover:text-ink">
          事实
        </Link>
      </div>
      <RewriteCard
        lead={base?.lead ?? ''}
        text={base?.text ?? ''}
        facts={event}
        job={focus}
        runToken={runToken}
        onState={onState}
        onInsights={onInsights}
        onAsk={() => navigate(`/app/chat?event=${event.id}`)}
        onFacts={(m) => addMetrics(event.id, m)}
        onApply={(lead, text) => {
          const id = applyRewrite(event.id, { variantId: targetId, angle, lead, text })
          // 按岗位改好的写法直接放进这个岗位的简历
          if (job && id) pickForJob(job.id, event.id, id)
        }}
      />
    </article>
  )
}

export function RewritePage() {
  const [params, setParams] = useSearchParams()
  const library = useStore((s) => s.library)
  const jobs = useStore((s) => s.jobs)
  const ids = (params.get('exp') ?? '').split(',').filter(Boolean)
  const jobId = params.get('job') ?? ''
  const job = jobs.find((j) => j.id === jobId)
  const selected = ordered(library.experiences.filter((e) => ids.includes(e.id)))
  const others = library.experiences.filter((e) => !ids.includes(e.id))
  const [runToken, setRunToken] = useState(0)
  const [states, setStates] = useState<Record<string, RewriteState>>({})
  const [insights, setInsights] = useState<Record<string, Insight[]>>({})
  const [adding, setAdding] = useState(false)

  const focus: JobFocus | undefined = useMemo(
    () => (job ? { title: job.title, company: job.company, keywords: jobKeywords(job.raw), requirements: job.requirements.map((r) => r.text) } : undefined),
    [job],
  )

  const events = selected.flatMap((exp) => library.events.filter((e) => e.experienceId === exp.id))
  const done = events.filter((e) => states[e.id] === 'done').length
  const reviewing = events.filter((e) => states[e.id] === 'review').length

  // 能力画像：所有重写结果里的能力汇总
  const portrait = useMemo(() => {
    const map = new Map<string, { n: number; evidence: string[] }>()
    for (const list of Object.values(insights))
      for (const i of list) {
        const m = map.get(i.label) ?? { n: 0, evidence: [] }
        m.n += 1
        if (m.evidence.length < 2) m.evidence.push(i.evidence)
        map.set(i.label, m)
      }
    return [...map.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 6)
  }, [insights])

  if (selected.length === 0) return <div className="scroll-thin h-full overflow-y-auto"><Picker /></div>

  const setScope = (next: string[]) => {
    const p = new URLSearchParams(params)
    if (next.length) p.set('exp', next.join(','))
    else p.delete('exp')
    setParams(p, { replace: true })
  }

  return (
    <div className="flex h-full">
      <div className="scroll-thin min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[780px] px-12 pb-32 pt-12">
          <p className="label">经历重写</p>
          <h1 className="mt-1.5 text-[34px] font-semibold leading-tight tracking-[0.04em]">让经历说出你的能力</h1>
          <p className="mt-2 text-[15px] text-ink-3">AI 只用事实里有的内容；数字和成果不会凭空出现</p>

          <div className="mt-7 flex flex-wrap items-center gap-2">
            {selected.map((e) => (
              <span key={e.id} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-mist pl-3.5 pr-1.5 text-[13.5px]">
                {e.org || '未命名经历'}
                <button className="grid size-5 place-items-center rounded-full text-ink-3 hover:bg-paper hover:text-ink" onClick={() => setScope(ids.filter((x) => x !== e.id))} aria-label={`移除 ${e.org}`}>
                  <X size={12} />
                </button>
              </span>
            ))}
            {others.length > 0 && (
              <span className="relative">
                <button className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[13px] text-ink-3 hover:bg-mist hover:text-ink" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
                  <Plus size={13} strokeWidth={1.5} />
                  添加经历
                </button>
                {adding && (
                  <div className="pop absolute left-0 top-10 z-20 w-[280px] animate-rise p-1.5">
                    {others.map((e) => (
                      <button
                        key={e.id}
                        className="block w-full rounded-[10px] px-3 py-2 text-left text-[14px] hover:bg-mist"
                        onClick={() => {
                          setScope([...ids, e.id])
                          setAdding(false)
                        }}
                      >
                        {e.org || '未命名经历'}
                        <span className="ml-2 text-[12px] text-ink-3">{KIND_LABEL[e.kind]}</span>
                      </button>
                    ))}
                  </div>
                )}
              </span>
            )}
          </div>

          <div className="glass sticky top-4 z-10 mt-6 flex flex-wrap items-center gap-3 rounded-full py-1.5 pl-4 pr-1.5">
            <label className="flex items-center gap-2 text-[13.5px] text-ink-2">
              角度
              <select
                className="select-pill"
                value={jobId}
                onChange={(e) => {
                  const p = new URLSearchParams(params)
                  if (e.target.value) p.set('job', e.target.value)
                  else p.delete('job')
                  setParams(p, { replace: true })
                  setStates({})
                }}
              >
                <option value="">通用表达</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    按「{j.title || '未识别职位'}」
                  </option>
                ))}
              </select>
            </label>
            <span className="text-[13px] text-ink-3">
              <span className="num">{events.length}</span> 件事
              {reviewing > 0 && <> · <span className="num">{reviewing}</span> 处待你决定</>}
            </span>
            <button className="btn btn-primary btn-sm ml-auto" onClick={() => setRunToken((t) => t + 1)} disabled={events.length === 0}>
              <Sparkles size={13} strokeWidth={1.6} />
              全部重写
            </button>
          </div>

          {selected.map((exp) => {
            const evs = library.events.filter((e) => e.experienceId === exp.id)
            return (
              <section key={exp.id} className="mt-14">
                <div className="flex items-end justify-between gap-4 border-b border-ink pb-3">
                  <div className="min-w-0">
                    <p className="label">{KIND_LABEL[exp.kind]}</p>
                    <h2 className="mt-1 truncate text-[24px] font-semibold tracking-[0.03em]">{exp.org || '未命名经历'}</h2>
                  </div>
                  <span className="shrink-0 text-[13.5px] text-ink-3">
                    {roleLine(exp)}
                    {roleLine(exp) && <span className="mx-2 text-ink-4">·</span>}
                    <span className="num">{dateRange(exp.start, exp.end)}</span>
                  </span>
                </div>
                {evs.length === 0 ? (
                  <p className="py-6 text-[14px] text-ink-3">
                    这段经历还没有具体的事。
                    <Link to={`/app/chat?exp=${exp.id}`} className="link ml-1 text-ink">
                      和 AI 聊出来
                    </Link>
                  </p>
                ) : (
                  <div className="pt-6">
                    {evs.map((ev) => (
                      <EventRewrite
                        key={`${ev.id}-${jobId}`}
                        event={ev}
                        job={job}
                        focus={focus}
                        runToken={runToken}
                        onState={(s) => setStates((x) => ({ ...x, [ev.id]: s }))}
                        onInsights={(i) => setInsights((x) => ({ ...x, [ev.id]: i }))}
                      />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      </div>

      <aside className="hidden w-[320px] shrink-0 flex-col border-l border-rule xl:flex">
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-8 pb-8 pt-12">
          <p className="label">进度</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="num text-[34px] font-semibold leading-none">{done}</span>
            <span className="text-[14px] text-ink-3">/ {events.length} 件已更新</span>
          </div>
          <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-rule">
            <div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${events.length ? (done / events.length) * 100 : 0}%` }} />
          </div>

          <p className="label mt-10">你的经历体现了</p>
          {portrait.length === 0 ? (
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">重写之后，这里会汇总每件事体现的能力，以及原文里的依据。</p>
          ) : (
            <ul className="mt-3 space-y-3.5">
              {portrait.map(([label, m]) => (
                <li key={label} className="animate-rise">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[15px] font-semibold">{label}</span>
                    <span className="num text-[12.5px] text-ink-3">{m.n} 件事</span>
                  </div>
                  <div className="mt-0.5 text-[12.5px] leading-relaxed text-ink-3">{m.evidence.map((e) => `「${e}」`).join(' ')}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-rule px-8 py-5">
          <p className="label">下一步</p>
          <p className="mt-1 text-[14px] text-ink-2">
            {job
              ? done > 0
                ? `采纳的 ${done} 件已放进「${job.title || '这个岗位'}」的简历，去选版式`
                : `回到「${job.title || '这个岗位'}」，选版式生成简历`
              : '用重写好的经历，对准一个想投的岗位'}
          </p>
          <Link
            to={job ? `/app/jobs/${job.id}?step=build` : '/app'}
            state={job ? undefined : { side: 'job' }}
            className="btn btn-primary group mt-3 w-full"
          >
            {job ? '去生成简历' : '适配岗位'}
            <ArrowRight size={15} strokeWidth={1.6} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </aside>
    </div>
  )
}
