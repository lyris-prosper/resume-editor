import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { ArrowRight, Check, Loader2, Plus, Sparkles, X } from 'lucide-react'
import { useStore } from '../store/store'
import { ai } from '../lib/ai'
import { jobKeywords } from '../lib/ai/rewrite'
import type { JobFocus } from '../lib/ai/types'
import { recommendPicks, type MatchLevel, type RequirementMatch } from '../lib/match'
import { assembleResume, contentVolume, eventLine, validatePicks, type Pick } from '../lib/assemble'
import { KIND_ORDER, type Event, type JobTarget, type Requirement, type RequirementKind, type TemplateId } from '../lib/schema'
import { TEMPLATE_ACCENT, TEMPLATE_GROUPS } from '../lib/templates'
import { uid } from '../lib/ids'
import { byTimeDesc, relativeTime } from '../lib/format'
import { SAMPLE_JOB } from '../data/sampleJob'
import { A4, Paper } from '../templates/Paper'
import { LevelDot } from '../components/LevelDot'
import { AutoTextarea, Empty, TextButton } from '../components/ui'
import { RewriteCard } from '../board/RewriteCard'

const KIND_LABEL: Record<RequirementKind, string> = { duty: '岗位职责', core: '核心要求', hard: '门槛条件', bonus: '加分项' }
const KIND_ORDER_REQ: RequirementKind[] = ['duty', 'core', 'bonus', 'hard']
const DOT: Record<MatchLevel, 'full' | 'half' | 'none'> = { direct: 'full', partial: 'half', none: 'none' }
const LEVEL_LABEL: Record<MatchLevel, string> = { direct: '有依据', partial: '部分相关', none: '待补充' }

type Step = 'match' | 'adjust' | 'build'
const STEPS: { id: Step; label: string }[] = [
  { id: 'match', label: '对照要求' },
  { id: 'adjust', label: '调整表达' },
  { id: 'build', label: '生成简历' },
]

/** 宽度跟随内容的输入；没识别出的内容用虚线下划线提示 */
function Inline({ value, onChange, placeholder, className = '' }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <span
      className={`inline-grid max-w-full align-baseline after:invisible after:whitespace-pre after:content-[attr(data-value)] after:[grid-area:1/1] ${className}`}
      data-value={(value || placeholder) + ' '}
    >
      <input
        size={1}
        className={`inline-edit w-full min-w-0 [grid-area:1/1] ${value ? '' : 'border-b border-dashed border-ink-4'}`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
      />
    </span>
  )
}

function NewJob() {
  const upsertJob = useStore((s) => s.upsertJob)
  const navigate = useNavigate()
  const [raw, setRaw] = useState('')
  const [busy, setBusy] = useState(false)

  const parse = async () => {
    setBusy(true)
    try {
      const parsed = await ai.parseJob(raw)
      const job: JobTarget = {
        id: uid('job'),
        company: parsed.company,
        title: parsed.title,
        location: parsed.location,
        raw,
        responsibilities: parsed.responsibilities,
        requirements: parsed.requirements.map((r) => ({ ...r, id: uid('req') })),
        picks: [],
        createdAt: Date.now(),
      }
      upsertJob(job)
      navigate(`/app/jobs/${job.id}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-[760px] px-14 pb-24 pt-12">
      <p className="label">适配岗位</p>
      <h2 className="mt-1.5 text-[34px] font-semibold leading-tight tracking-[0.04em]">粘贴一份招聘信息</h2>
      <p className="mt-2 text-[15px] text-ink-3">拆出职责和要求，再到事实库里逐条找依据</p>
      <div className="mt-8 rounded-[20px] shadow-[0_0_0_1px_rgb(17_17_17/0.1)] transition-shadow focus-within:shadow-[0_0_0_1.5px_var(--color-ink)]">
        <textarea
          className="block min-h-[320px] w-full resize-y rounded-[20px] bg-transparent px-6 py-5 text-[15px] leading-[1.95] outline-none"
          placeholder={'把招聘页面上的文字整段复制过来，包括公司、职位、职责和要求。\n一次只放一个岗位。'}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          aria-label="招聘信息全文"
        />
      </div>
      <div className="mt-6 flex items-center justify-between">
        <button className="link-reveal text-[13.5px] text-ink-3 hover:text-ink" onClick={() => setRaw(SAMPLE_JOB)}>
          填入虚构示例
        </button>
        <button className="btn btn-primary" disabled={!raw.trim() || busy} onClick={parse}>
          {busy && <Loader2 size={14} className="animate-spin" />}
          开始适配
        </button>
      </div>
    </div>
  )
}

function Check13({ on }: { on: boolean }) {
  return (
    <span className={`mt-[5px] grid size-[14px] shrink-0 place-items-center rounded-[4px] border transition-colors ${on ? 'border-ink bg-ink text-paper' : 'border-rule-2 group-hover/e:border-ink'}`}>
      {on && <Check size={10} strokeWidth={3} />}
    </span>
  )
}

function RequirementRow({
  match,
  loading,
  picked,
  onToggle,
  onChange,
  onRemove,
}: {
  match: RequirementMatch
  loading: boolean
  picked: Set<string>
  onToggle: (eventId: string) => void
  onChange: (text: string) => void
  onRemove: () => void
}) {
  const navigate = useNavigate()
  const { requirement: r, level, candidates } = match
  const gate = r.kind === 'hard'
  return (
    <li className="group/r grid grid-cols-[18px_minmax(0,1fr)_minmax(0,0.95fr)] gap-x-5 border-t border-rule py-5">
      <span className="pt-[7px]">
        {loading ? <Loader2 size={12} className="animate-spin text-ink-3" /> : <LevelDot level={gate ? 'gate' : DOT[level]} label={gate ? '门槛条件' : LEVEL_LABEL[level]} />}
      </span>
      <div className="relative min-w-0 pr-6">
        <AutoTextarea className="inline-edit w-full text-[15.5px]" value={r.text} placeholder="写下这条要求" onChange={(e) => onChange(e.target.value)} aria-label="要求" />
        <button className="absolute right-0 top-1 text-ink-4 opacity-0 transition-opacity hover:text-ink focus:opacity-100 group-hover/r:opacity-100" onClick={onRemove} aria-label="删除这条要求">
          <X size={14} />
        </button>
      </div>
      <div className="min-w-0 pt-[3px] text-[14px]">
        {loading ? null : gate ? (
          <span className="text-ink-3">学历、到岗时间这类条件，请自己核对</span>
        ) : candidates.length > 0 ? (
          <ul className="space-y-2">
            {candidates.map((c) => {
              const on = picked.has(c.event.id)
              return (
                <li key={c.event.id}>
                  <button onClick={() => onToggle(c.event.id)} className="group/e flex w-full items-start gap-2.5 text-left" aria-pressed={on} title={on ? '已选入简历，点击取消' : '点击选入简历'}>
                    <Check13 on={on} />
                    <span className="min-w-0">
                      <span className={on ? 'text-ink' : 'text-ink-2'}>
                        {c.experience.org} · {c.event.title}
                      </span>
                      <span className="block text-[12.5px] text-ink-3">
                        {c.level === 'direct' ? '直接匹配' : '可迁移'}
                        {c.hits.length > 0 && `　命中：${c.hits.join('、')}`}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <span className="text-ink-3">
            事实库里还没有相关记录。
            <button className="link text-ink" onClick={() => navigate('/app/chat')}>
              补一件相关的事
            </button>
          </span>
        )}
      </div>
    </li>
  )
}

function StepBar({ step, setStep, counts }: { step: Step; setStep: (s: Step) => void; counts: { picks: number } }) {
  const idx = STEPS.findIndex((s) => s.id === step)
  return (
    <nav className="flex items-center gap-2" aria-label="步骤">
      {STEPS.map((s, i) => {
        const on = s.id === step
        const done = i < idx
        return (
          <div key={s.id} className="flex items-center gap-2">
            {i > 0 && <span className={`h-px w-8 ${i <= idx ? 'bg-ink' : 'bg-rule-2'}`} aria-hidden />}
            <button
              onClick={() => setStep(s.id)}
              disabled={i > 0 && counts.picks === 0}
              aria-current={on ? 'step' : undefined}
              className={`inline-flex h-8 items-center gap-2 rounded-full pl-1 pr-3.5 text-[13.5px] transition-colors disabled:opacity-40 ${on ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-mist hover:text-ink'}`}
            >
              <span className={`num grid size-6 place-items-center rounded-full text-[12px] ${on ? 'bg-paper/15' : done ? 'bg-ink text-paper' : 'shadow-[inset_0_0_0_1px_var(--color-rule-2)]'}`}>
                {done ? <Check size={12} strokeWidth={2.5} /> : i + 1}
              </span>
              {s.label}
            </button>
          </div>
        )
      })}
    </nav>
  )
}

/** 勾选一件事时默认用的写法：有为这个岗位改过的就用它，否则用主表达 */
function defaultVariant(ev: Event | undefined, job: JobTarget) {
  return (ev?.variants.find((v) => v.angle === (job.title || '岗位定制')) ?? ev?.variants[0])?.id
}

/** 选材：所有事件按经历分组，勾选并选择用哪种写法 */
function PickList({ job, picks, setPicks }: { job: JobTarget; picks: Pick[]; setPicks: (p: Pick[]) => void }) {
  const library = useStore((s) => s.library)
  const exps = KIND_ORDER.flatMap((k) =>
    byTimeDesc(
      library.experiences.filter((e) => e.kind === k),
      (e) => e,
    ),
  ).filter((exp) => library.events.some((e) => e.experienceId === exp.id))
  const toggle = (eventId: string) => {
    if (picks.some((p) => p.eventId === eventId)) setPicks(picks.filter((p) => p.eventId !== eventId))
    else setPicks([...picks, { eventId, variantId: defaultVariant(library.events.find((e) => e.id === eventId), job) }])
  }
  return (
    <div className="space-y-5">
      {exps.map((exp) => (
        <div key={exp.id}>
          <div className="mb-1.5 truncate text-[13px] tracking-[0.04em] text-ink-3">{exp.org}</div>
          <ul className="space-y-1.5">
            {library.events
              .filter((e) => e.experienceId === exp.id)
              .map((ev) => {
                const pick = picks.find((p) => p.eventId === ev.id)
                return (
                  <li key={ev.id}>
                    <button className="group/e flex w-full items-start gap-2.5 text-left text-[14.5px]" onClick={() => toggle(ev.id)} aria-pressed={!!pick}>
                      <Check13 on={!!pick} />
                      <span className={pick ? 'text-ink' : 'text-ink-3'}>{ev.title || '未命名的事'}</span>
                    </button>
                    {pick && ev.variants.length > 1 && (
                      <div className="ml-6 mt-1 flex flex-wrap gap-x-3 text-[12.5px]">
                        {ev.variants.map((v) => (
                          <button
                            key={v.id}
                            onClick={() => setPicks(picks.map((p) => (p.eventId === ev.id ? { ...p, variantId: v.id } : p)))}
                            className={`pb-px ${pick.variantId === v.id ? 'border-b border-ink text-ink' : 'text-ink-3 hover:text-ink'}`}
                          >
                            {v.angle}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                )
              })}
          </ul>
        </div>
      ))}
    </div>
  )
}

function MatchStep({ job, matches, picks, setPicks, setJob }: { job: JobTarget; matches: RequirementMatch[] | null; picks: Pick[]; setPicks: (p: Pick[]) => void; setJob: (fn: (j: JobTarget) => void) => void }) {
  const [showRaw, setShowRaw] = useState(false)
  const picked = new Set(picks.map((p) => p.eventId))
  const library = useStore((s) => s.library)
  const toggle = (eventId: string) => {
    if (picked.has(eventId)) setPicks(picks.filter((p) => p.eventId !== eventId))
    else setPicks([...picks, { eventId, variantId: defaultVariant(library.events.find((e) => e.id === eventId), job) }])
  }
  const stats = useMemo(() => {
    const scored = (matches ?? []).filter((m) => m.requirement.kind !== 'hard')
    return {
      direct: scored.filter((m) => m.level === 'direct').length,
      partial: scored.filter((m) => m.level === 'partial').length,
      none: scored.filter((m) => m.level === 'none').length,
      total: scored.length,
    }
  }, [matches])
  const rows = matches ?? job.requirements.map((r) => ({ requirement: r, level: 'none' as MatchLevel, candidates: [] }))
  const grouped = KIND_ORDER_REQ.map((kind) => ({ kind, items: rows.filter((m) => m.requirement.kind === kind) })).filter((g) => g.items.length)

  return (
    <>
      <p className="flex flex-wrap items-baseline gap-x-2 text-[15px] text-ink-2">
        <Inline value={job.company} placeholder="未识别公司" onChange={(v) => setJob((j) => void (j.company = v))} />
        <span className="text-ink-4">·</span>
        <Inline value={job.location} placeholder="地点未写明" onChange={(v) => setJob((j) => void (j.location = v))} />
        <span className="ml-3">
          <TextButton onClick={() => setShowRaw((v) => !v)}>{showRaw ? '收起原文' : '查看原文'}</TextButton>
        </span>
      </p>
      <h2 className="mt-2 text-[38px] font-semibold leading-[1.2] tracking-[0.03em]">
        <Inline value={job.title} placeholder="未识别职位" onChange={(v) => setJob((j) => void (j.title = v))} />
      </h2>
      {showRaw && <blockquote className="mt-5 max-h-80 overflow-y-auto whitespace-pre-wrap border-l-2 border-rule-2 pl-4 text-[14px] leading-[1.9] text-ink-2">{job.raw}</blockquote>}

      <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-2 border-y border-ink py-4 text-[14px]">
        {matches ? (
          <>
            <span className="flex items-center gap-2">
              <LevelDot level="full" />
              <span className="num font-semibold">{stats.direct}</span>
              <span className="text-ink-2">条有依据</span>
            </span>
            <span className="flex items-center gap-2">
              <LevelDot level="half" />
              <span className="num font-semibold">{stats.partial}</span>
              <span className="text-ink-2">条部分相关</span>
            </span>
            <span className="flex items-center gap-2">
              <LevelDot level="none" />
              <span className="num font-semibold">{stats.none}</span>
              <span className="text-ink-2">条待补充</span>
            </span>
            <span className="ml-auto text-[13px] text-ink-3">不代表录用概率</span>
          </>
        ) : (
          <span className="flex items-center gap-2 text-ink-3">
            <Loader2 size={13} className="animate-spin" />
            正在逐条找依据
          </span>
        )}
      </div>

      {grouped.map((g) => (
        <section key={g.kind} className="mt-12">
          <div className="mb-1 flex items-baseline justify-between">
            <h3 className="text-[17px] font-semibold tracking-[0.06em]">
              {KIND_LABEL[g.kind]}
              <sup className="num ml-1 text-[11px] font-normal text-ink-3">{g.items.length}</sup>
            </h3>
            {g.kind !== 'hard' && <span className="label">事实库里的依据 · 勾选放进简历</span>}
          </div>
          <ul>
            {g.items.map((m) => (
              <RequirementRow
                key={m.requirement.id}
                match={m}
                loading={!matches}
                picked={picked}
                onToggle={toggle}
                onChange={(text) => setJob((j) => void (j.requirements.find((r) => r.id === m.requirement.id)!.text = text))}
                onRemove={() => setJob((j) => void (j.requirements = j.requirements.filter((r) => r.id !== m.requirement.id)))}
              />
            ))}
          </ul>
        </section>
      ))}
      <button
        className="mt-6 inline-flex items-center gap-1 text-[13.5px] text-ink-3 hover:text-ink"
        onClick={() => setJob((j) => void j.requirements.push({ id: uid('req'), kind: 'core', text: '' } satisfies Requirement))}
      >
        <Plus size={14} strokeWidth={1.5} />
        补一条要求
      </button>
    </>
  )
}

function AdjustStep({ job, picks, setPicks }: { job: JobTarget; picks: Pick[]; setPicks: (p: Pick[]) => void }) {
  const library = useStore((s) => s.library)
  const applyRewrite = useStore((s) => s.applyRewrite)
  const addMetrics = useStore((s) => s.addMetrics)
  const navigate = useNavigate()
  const [runToken, setRunToken] = useState(0)
  const focus: JobFocus = useMemo(() => ({ title: job.title, company: job.company, keywords: jobKeywords(job.raw), requirements: job.requirements.map((r) => r.text) }), [job])
  const angle = job.title || '岗位定制'
  const items = picks.map((p) => ({ pick: p, ev: library.events.find((e) => e.id === p.eventId) })).filter((x) => x.ev)

  return (
    <>
      <h2 className="text-[32px] font-semibold leading-tight tracking-[0.04em]">按「{job.title || '这个岗位'}」调整表达</h2>
      <div className="mt-2 flex items-center justify-between gap-6">
        <p className="text-[15px] text-ink-3">调整角度、重点和顺序，不添加事实。采纳后存为「{angle}」写法</p>
        <button className="btn btn-primary btn-sm shrink-0" onClick={() => setRunToken((t) => t + 1)} disabled={!items.length}>
          <Sparkles size={13} strokeWidth={1.6} />
          全部调整
        </button>
      </div>
      <div className="mt-10">
        {items.map(({ pick, ev }) => {
          const line = eventLine(ev!, pick.variantId)
          const exp = library.experiences.find((x) => x.id === ev!.experienceId)
          const tailoredId = ev!.variants.find((v) => v.angle === angle)?.id
          return (
            <article key={ev!.id} className="border-t border-rule py-8 first:border-t-0 first:pt-0">
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <h3 className="text-[18px] font-semibold tracking-[0.02em]">
                  {ev!.title}
                  <span className="ml-2 text-[13px] font-normal text-ink-3">{exp?.org}</span>
                </h3>
                {ev!.variants.length > 1 && (
                  <select
                    className="select-pill"
                    value={pick.variantId ?? ''}
                    onChange={(e) => setPicks(picks.map((p) => (p.eventId === ev!.id ? { ...p, variantId: e.target.value } : p)))}
                    aria-label="用哪种写法"
                  >
                    {ev!.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.angle}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <RewriteCard
                key={`${ev!.id}-${pick.variantId}`}
                lead={line.lead}
                text={line.text}
                facts={ev!}
                job={focus}
                runToken={runToken}
                onAsk={() => navigate(`/app/chat?event=${ev!.id}`)}
                onFacts={(m) => addMetrics(ev!.id, m)}
                onApply={(lead, text) => {
                  const id = applyRewrite(ev!.id, { variantId: tailoredId, angle, lead, text })
                  if (id) setPicks(picks.map((p) => (p.eventId === ev!.id ? { ...p, variantId: id } : p)))
                }}
              />
            </article>
          )
        })}
      </div>
    </>
  )
}

function BuildStep({ job, picks, template, setTemplate }: { job: JobTarget; picks: Pick[]; template: TemplateId; setTemplate: (t: TemplateId) => void }) {
  const library = useStore((s) => s.library)
  const preview = useMemo(() => assembleResume({ library, picks, template: 'classic', job }), [library, picks, job])
  const rich = contentVolume(preview).rich
  const scale = 0.25
  return (
    <>
      <h2 className="text-[32px] font-semibold leading-tight tracking-[0.04em]">选一套版式</h2>
      <p className="mt-2 text-[15px] text-ink-3">
        这份简历用到 <span className="num">{picks.length}</span> 件事，{rich ? '内容较多，推荐“履历丰富”一组' : '一页就能放下，推荐“一页简洁”一组'}
      </p>
      {TEMPLATE_GROUPS.map((g) => (
        <section key={g.id} className="mt-10">
          <div className="mb-4 flex items-baseline gap-3">
            <h3 className="text-[17px] font-semibold tracking-[0.06em]">{g.label}</h3>
            <span className="text-[13px] text-ink-3">{g.note}</span>
            {(g.id === 'rich') === rich && <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] text-paper">推荐</span>}
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-x-6 gap-y-8">
            {g.items.map((t) => {
              const on = template === t.id
              const r = { ...preview, template: t.id, style: { ...preview.style, accent: TEMPLATE_ACCENT[t.id] } }
              return (
                <button key={t.id} onClick={() => setTemplate(t.id)} className="group text-left" aria-pressed={on}>
                  <div
                    className={`overflow-hidden rounded-[4px] bg-white transition-[box-shadow,transform] duration-300 group-hover:-translate-y-1 ${on ? 'shadow-[0_0_0_2px_var(--color-ink),0_18px_40px_-20px_rgb(17_17_17/0.4)]' : 'paper-shadow'}`}
                    style={{ width: A4.width * scale, height: A4.height * scale }}
                  >
                    <div className="pointer-events-none origin-top-left" style={{ transform: `scale(${scale})` }}>
                      <Paper resume={r} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-[14.5px] font-semibold">
                    {on && <Check size={14} strokeWidth={2.4} />}
                    {t.name}
                  </div>
                  <div className="text-[12.5px] text-ink-3">{t.note}</div>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </>
  )
}

function JobDetail({ job }: { job: JobTarget }) {
  const library = useStore((s) => s.library)
  const upsertJob = useStore((s) => s.upsertJob)
  const upsertResume = useStore((s) => s.upsertResume)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const step = (STEPS.some((s) => s.id === params.get('step')) ? params.get('step') : 'match') as Step
  const setStep = (s: Step) => {
    const p = new URLSearchParams(params)
    p.set('step', s)
    setParams(p, { replace: true })
    document.getElementById('job-scroll')?.scrollTo({ top: 0 })
  }
  const [matches, setMatches] = useState<RequirementMatch[] | null>(null)
  const [template, setTemplate] = useState<TemplateId>('classic')
  const [problems, setProblems] = useState<string[]>([])

  const setJob = (fn: (j: JobTarget) => void) => {
    const next = structuredClone(useStore.getState().jobs.find((j) => j.id === job.id) ?? job)
    fn(next)
    upsertJob(next)
  }
  // 过滤掉已删除的事件
  const picks = job.picks.filter((p) => library.events.some((e) => e.id === p.eventId))
  const setPicks = (p: Pick[]) => setJob((j) => void (j.picks = p))

  const reqKey = job.requirements.map((r) => r.kind + r.text).join('|')
  useEffect(() => {
    let alive = true
    setMatches(null)
    ai.matchRequirements(library, job.requirements).then((m) => {
      if (!alive) return
      setMatches(m)
      if (job.picks.length === 0) setJob((j) => void (j.picks = recommendPicks(m, job.raw)))
    })
    return () => {
      alive = false
    }
    // 只在要求或事实库的事件变化时重新匹配
  }, [reqKey, library.events]) // eslint-disable-line react-hooks/exhaustive-deps

  // 推荐版式：内容多时用高密度
  useEffect(() => {
    if (step !== 'build') return
    const rich = contentVolume(assembleResume({ library, picks, template: 'classic', job })).rich
    setTemplate((t) => (t === 'classic' && rich ? 'dense' : t))
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  const generate = () => {
    const errs = validatePicks(library, picks)
    if (errs.length) return setProblems(errs.map((e) => e.reason))
    const resume = assembleResume({ library, picks, template, job })
    upsertResume(resume)
    navigate(`/app/resumes/${resume.id}`)
  }

  const next: Record<Step, { label: string; go: () => void }> = {
    match: { label: '下一步：调整表达', go: () => setStep('adjust') },
    adjust: { label: '下一步：选版式', go: () => setStep('build') },
    build: { label: `用 ${picks.length} 件事生成简历`, go: generate },
  }

  return (
    <div className="flex h-full">
      <div id="job-scroll" className="scroll-thin min-w-0 flex-1 overflow-y-auto">
        <div className="glass sticky top-0 z-10 flex items-center justify-between gap-4 !rounded-none px-14 py-3 !shadow-[0_1px_0_var(--color-rule)]">
          <StepBar step={step} setStep={setStep} counts={{ picks: picks.length }} />
        </div>
        <div className="mx-auto max-w-[880px] px-14 pb-32 pt-10">
          {step === 'match' && <MatchStep job={job} matches={matches} picks={picks} setPicks={setPicks} setJob={setJob} />}
          {step === 'adjust' && <AdjustStep job={job} picks={picks} setPicks={setPicks} />}
          {step === 'build' && <BuildStep job={job} picks={picks} template={template} setTemplate={setTemplate} />}
        </div>
      </div>

      <aside className="flex w-[320px] shrink-0 flex-col border-l border-rule">
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-8 pb-8 pt-10">
          <p className="label">选材</p>
          <h3 className="mt-1.5 text-[22px] font-semibold tracking-[0.03em]">这份简历会用到</h3>
          <p className="mt-1 text-[13px] text-ink-3">按要求推荐，最终由你决定</p>
          <div className="mt-6">
            <PickList job={job} picks={picks} setPicks={setPicks} />
          </div>
          {library.events.length === 0 && <p className="mt-4 text-[13.5px] text-ink-3">事实库还没有经历。先导入简历或和 AI 聊一段。</p>}
        </div>
        <div className="border-t border-rule px-8 py-5">
          {problems.length > 0 && (
            <div className="mb-3 text-[13px] text-alert">
              {problems.map((p) => (
                <div key={p}>{p}</div>
              ))}
            </div>
          )}
          <button className="btn btn-primary btn-lg group w-full" disabled={picks.length === 0} onClick={next[step].go}>
            {next[step].label}
            <ArrowRight size={16} strokeWidth={1.5} className="transition-transform group-hover:translate-x-0.5" />
          </button>
          <p className="mt-2.5 text-center text-[12.5px] text-ink-3">{step === 'build' ? '生成后还能换版式、改措辞' : `已选 ${picks.length} 件事`}</p>
        </div>
      </aside>
    </div>
  )
}

export function JobsPage() {
  const { jobId } = useParams()
  const jobs = useStore((s) => s.jobs)
  const deleteJob = useStore((s) => s.deleteJob)
  const navigate = useNavigate()
  const job = jobs.find((j) => j.id === jobId)

  return (
    <div className="flex h-full">
      <aside className="flex w-[260px] shrink-0 flex-col border-r border-rule">
        <div className="px-8 pb-5 pt-10">
          <h1 className="text-[30px] font-semibold leading-tight tracking-[0.04em]">岗位</h1>
          <button className={`btn btn-sm mt-6 w-full ${job || jobId ? 'btn-outline' : 'btn-primary'}`} onClick={() => navigate('/app/jobs')}>
            <Plus size={14} strokeWidth={1.5} />
            新的岗位
          </button>
        </div>
        <nav className="scroll-thin min-h-0 flex-1 overflow-y-auto pb-10 pl-3 pr-5" aria-label="岗位列表">
          {jobs.length === 0 ? (
            <p className="pl-5 text-[13px] text-ink-4">还没有岗位</p>
          ) : (
            jobs.map((j) => {
              const active = j.id === jobId
              return (
                <div key={j.id} className="group relative">
                  <button
                    onClick={() => navigate(`/app/jobs/${j.id}`)}
                    className={`relative block w-full rounded-r-md py-2.5 pl-5 pr-8 text-left transition-colors ${active ? 'text-ink' : 'text-ink-2 hover:bg-mist hover:text-ink'}`}
                  >
                    <span className={`absolute bottom-2 left-0 top-2 w-[2px] rounded-full bg-ink ${active ? 'opacity-100' : 'opacity-0'}`} />
                    <span className={`block truncate text-[15px] ${active ? 'font-semibold' : ''}`}>{j.title || '未识别职位'}</span>
                    <span className="block truncate text-[12.5px] text-ink-3">
                      {j.company || '未识别公司'} · <span className="num">{relativeTime(j.createdAt)}</span>
                    </span>
                  </button>
                  <button
                    className="absolute right-1 top-3 hidden text-ink-4 hover:text-ink group-hover:block"
                    aria-label="删除岗位"
                    onClick={() => {
                      if (confirm('删除这个岗位？用它生成的简历会保留。')) {
                        deleteJob(j.id)
                        if (active) navigate('/app/jobs')
                      }
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )
            })
          )}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        {job ? (
          <JobDetail key={job.id} job={job} />
        ) : jobId ? (
          <Empty title="找不到这个岗位">它可能已经被删除。</Empty>
        ) : (
          <div className="scroll-thin h-full overflow-y-auto">
            <NewJob />
          </div>
        )}
      </div>
    </div>
  )
}
