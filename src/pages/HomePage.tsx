import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ArrowRight, ArrowUpRight, Check, ClipboardPaste, FileText, FileUp, Highlighter, Layers, ListChecks, Loader2, MessageCircle, Sparkles, Target, WandSparkles } from 'lucide-react'
import { useStore } from '../store/store'
import { ai } from '../lib/ai'
import { KIND_LABEL, type JobTarget } from '../lib/schema'
import { uid } from '../lib/ids'
import { byTimeDesc } from '../lib/format'
import { useMedia } from '../lib/useMedia'
import { MATERIAL_ACCEPT, readMaterial } from '../lib/readFile'
import { SAMPLE_JOB } from '../data/sampleJob'
import { LevelDot } from '../components/LevelDot'
import { NextStep } from '../components/NextStep'

type Side = 'job' | 'rewrite'

function greeting() {
  const h = new Date().getHours()
  return h < 6 ? '夜深了' : h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好'
}

/** 立体图标底座 */
function Tile({ children, size = 56 }: { children: ReactNode; size?: number }) {
  return (
    <span className="tile-3d" style={{ width: size, height: size, borderRadius: size * 0.29 }}>
      {children}
    </span>
  )
}

/** 图标 + 短文字的功能块 */
function Feature({ icon, title, note }: { icon: ReactNode; title: string; note: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="tile-3d !rounded-[11px]" style={{ width: 34, height: 34 }}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[14px] font-semibold leading-snug">{title}</div>
        <div className="text-[12.5px] leading-snug text-ink-3">{note}</div>
      </div>
    </div>
  )
}

/* ---------- 两个面板里的小场景：只用产品里真实出现的样式 ---------- */

function JobScene() {
  const rows: { level: 'full' | 'half' | 'none'; req: string }[] = [
    { level: 'full', req: '具备用户研究能力' },
    { level: 'full', req: '熟悉 Excel 数据分析' },
    { level: 'half', req: '有 Figma 原型经验' },
    { level: 'none', req: '有上线转化数据' },
  ]
  return (
    <div className="relative mx-auto h-[220px] w-[300px] [perspective:1000px]" aria-hidden>
      <div className="absolute left-[18px] top-[6px] h-[200px] w-[150px] rounded-[6px] bg-white shadow-[0_0_0_1px_rgb(17_17_17/0.06),0_24px_40px_-24px_rgb(17_17_17/0.4)] transition-transform duration-700 ease-panel [transform:rotateY(18deg)_rotateX(6deg)_translateZ(-30px)] group-hover/panel:[transform:rotateY(12deg)_rotateX(4deg)_translateZ(-20px)]">
        <div className="mx-4 mt-5 h-2.5 w-14 rounded-full bg-ink/80" />
        <div className="mx-4 mt-2 h-1.5 w-20 rounded-full bg-ink/15" />
        {[0, 1, 2].map((k) => (
          <div key={k} className="mx-4 mt-4 space-y-1.5">
            <div className="h-1.5 w-16 rounded-full bg-ink/50" />
            <div className="h-1.5 w-[104px] rounded-full bg-ink/12" />
            <div className="h-1.5 w-[90px] rounded-full bg-ink/12" />
          </div>
        ))}
      </div>
      <div className="glass absolute right-0 top-[44px] w-[190px] rounded-[14px] px-4 py-3 transition-transform duration-700 ease-panel [transform:rotateY(-10deg)_translateZ(30px)] group-hover/panel:[transform:rotateY(-4deg)_translateZ(40px)]">
        <div className="text-[11px] tracking-[0.12em] text-ink-3">岗位要求</div>
        {rows.map((r) => (
          <div key={r.req} className="mt-2 flex items-center gap-2 text-[12px]">
            <LevelDot level={r.level} />
            <span className={r.level === 'none' ? 'text-ink-3' : ''}>{r.req}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RewriteScene() {
  return (
    <div className="relative mx-auto h-[220px] w-[310px] [perspective:1000px]" aria-hidden>
      <div className="absolute inset-x-2 top-[14px] rounded-[10px] bg-white px-5 pb-6 pt-5 shadow-[0_0_0_1px_rgb(17_17_17/0.06),0_30px_50px_-28px_rgb(17_17_17/0.45)] transition-transform duration-700 ease-panel [transform:rotateX(14deg)_rotateY(-8deg)] group-hover/panel:[transform:rotateX(8deg)_rotateY(-3deg)]">
        <div className="text-[11px] tracking-[0.12em] text-ink-3">星野科技 · 用户访谈整理</div>
        <p className="relative mt-2.5 text-[13.5px] leading-[2]">
          整理 12 位同学的访谈记录，
          <span className="diff-del">做了一些归类</span>
          <span className="relative">
            <span className="diff-ins">按问题主题归类</span>
            <span className="absolute -left-px -top-[2px] h-[calc(100%+4px)] w-[2px] rounded-full bg-handle">
              <span className="absolute -top-[6px] left-1/2 size-[8px] -translate-x-1/2 rounded-full bg-handle shadow-[0_0_0_1.5px_#fff]" />
            </span>
            <span className="absolute -right-px -top-[2px] h-[calc(100%+4px)] w-[2px] rounded-full bg-handle">
              <span className="absolute -bottom-[6px] left-1/2 size-[8px] -translate-x-1/2 rounded-full bg-handle shadow-[0_0_0_1.5px_#fff]" />
            </span>
          </span>
          ，将反馈归纳为 3 类问题。
        </p>
        <div className="mt-3 flex gap-1.5">
          {['用户研究', '信息归纳'].map((t) => (
            <span key={t} className="rounded-full bg-mist px-2 py-0.5 text-[11px] text-ink-2">
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className="absolute left-[118px] top-0 -translate-x-1/2 [transform:translateZ(40px)]">
        <div className="callout !h-[28px] !text-[12px]">
          <span className="grid place-items-center px-3">采纳</span>
          <span className="grid place-items-center px-3 shadow-[inset_1px_0_0_rgb(255_255_255/0.18)]">保留原文</span>
        </div>
      </div>
    </div>
  )
}

/* ---------- 面板外壳：展开与收窄 ---------- */

const isTextField = (el: EventTarget) => el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && el.type !== 'checkbox' && el.type !== 'file')

function Panel({
  side,
  open,
  wide,
  onIntent,
  onLeave,
  onExpand,
  onFocusChange,
  compact,
  children,
  label,
}: {
  side: Side
  open: boolean
  wide: boolean
  onIntent: (s: Side) => void
  onLeave: () => void
  onExpand: (s: Side) => void
  onFocusChange: (s: Side | null) => void
  compact: ReactNode
  children: ReactNode
  label: string
}) {
  const showFull = open || !wide
  return (
    <section
      aria-label={label}
      className={`group/panel panel-3d relative overflow-hidden ${wide ? 'min-h-0 transition-[flex-grow] duration-700 ease-panel' : ''}`}
      style={wide ? { flexGrow: open ? 2.1 : 1, flexBasis: 0, flexShrink: 1 } : undefined}
      onPointerEnter={(e) => e.pointerType === 'mouse' && onIntent(side)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && onLeave()}
      onFocusCapture={(e) => onFocusChange(isTextField(e.target) ? side : null)}
      onBlurCapture={() => onFocusChange(null)}
      onDragEnter={() => onExpand(side)}
    >
      {wide && (
        <button
          type="button"
          className={`absolute inset-0 z-10 flex flex-col p-9 text-left transition-opacity ${open ? 'pointer-events-none opacity-0 duration-150' : 'opacity-100 delay-200 duration-500'}`}
          onClick={() => onExpand(side)}
          tabIndex={open ? -1 : 0}
          aria-hidden={open}
          aria-label={`展开${label}`}
        >
          {compact}
        </button>
      )}
      <div
        className={`flex h-full flex-col transition-[opacity,transform] ${
          showFull ? 'opacity-100 delay-150 duration-500' : 'pointer-events-none translate-y-2 opacity-0 duration-150'
        }`}
        style={wide ? { minWidth: 640 } : undefined}
        inert={!showFull}
      >
        {children}
      </div>
    </section>
  )
}

function CompactFace({ icon, title, line, scene }: { icon: ReactNode; title: string; line: string; scene: ReactNode }) {
  return (
    <>
      <Tile size={60}>{icon}</Tile>
      <h2 className="mt-7 text-[32px] font-semibold leading-tight tracking-[0.04em]">{title}</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{line}</p>
      <div className="flex flex-1 items-center justify-center py-6">{scene}</div>
      <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 transition-colors group-hover/panel:text-ink">
        展开
        <ArrowRight size={14} strokeWidth={1.6} />
      </span>
    </>
  )
}

/* ---------- 左：适配岗位 ---------- */

function JobFace({ target, jd, setJd, focusRef }: { target?: string; jd: string; setJd: (v: string) => void; focusRef: React.RefObject<HTMLTextAreaElement | null> }) {
  const jobs = useStore((s) => s.jobs)
  const hasLibrary = useStore((s) => s.library.events.length > 0)
  const upsertJob = useStore((s) => s.upsertJob)
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const start = async () => {
    setBusy(true)
    try {
      const parsed = await ai.parseJob(jd)
      const job: JobTarget = {
        id: uid('job'),
        company: parsed.company,
        title: parsed.title || target || '',
        location: parsed.location,
        raw: jd,
        responsibilities: parsed.responsibilities,
        requirements: parsed.requirements.map((r) => ({ ...r, id: uid('req') })),
        picks: [],
        createdAt: Date.now(),
      }
      upsertJob(job)
      setJd('')
      navigate(`/app/jobs/${job.id}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="scroll-thin flex h-full flex-col overflow-y-auto p-6 sm:p-9">
      <div className="flex items-center gap-4">
        <Tile size={48}>
          <Target size={22} strokeWidth={1.5} />
        </Tile>
        <div>
          <h2 className="text-[26px] font-semibold leading-tight tracking-[0.04em]">适配岗位</h2>
          <p className="text-[14px] text-ink-3">{target ? `想投「${target}」？把它的招聘信息粘贴进来` : '粘贴招聘信息，让简历对准它'}</p>
        </div>
      </div>

      <div className="mt-7 rounded-[20px] bg-mist/70 p-1.5 shadow-[inset_0_1px_2px_rgb(17_17_17/0.06)]">
        <div className="rounded-[16px] bg-paper shadow-[0_0_0_1px_rgb(17_17_17/0.06),0_1px_2px_rgb(17_17_17/0.04)] transition-shadow focus-within:shadow-[0_0_0_1.5px_var(--color-ink)]">
          <textarea
            ref={focusRef}
            className="scroll-thin block h-[clamp(120px,22vh,220px)] w-full resize-none rounded-[16px] bg-transparent px-5 py-4 text-[15px] leading-[1.85] outline-none"
            placeholder={'把招聘页面的文字整段粘贴进来\n公司、职位、职责和要求都带上'}
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            aria-label="招聘信息"
          />
          <div className="flex items-center justify-between gap-3 border-t border-rule px-3 py-2.5">
            <button className="btn btn-quiet btn-sm" onClick={() => setJd(SAMPLE_JOB)}>
              <ClipboardPaste size={13} strokeWidth={1.6} />
              填入示例
            </button>
            <button className="btn btn-primary btn-sm group" disabled={!jd.trim() || busy} onClick={start}>
              {busy && <Loader2 size={13} className="animate-spin" />}
              开始适配
              <ArrowRight size={14} strokeWidth={1.6} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>
      {!hasLibrary && <p className="mt-3 text-[13px] text-ink-3">事实库还空着。先在右边整理经历，匹配才有依据。</p>}

      {jobs.length > 0 && (
        <div className="mt-7">
          <p className="label mb-2">继续之前的岗位</p>
          <ul className="divide-y divide-rule border-y border-rule">
            {jobs.slice(0, 3).map((j) => (
              <li key={j.id}>
                <Link to={`/app/jobs/${j.id}`} className="group flex items-center gap-3 py-2.5 text-[14.5px]">
                  <span className="min-w-0 flex-1 truncate">
                    {j.title || '未识别职位'}
                    <span className="ml-2 text-[13px] text-ink-3">{j.company}</span>
                  </span>
                  <ArrowUpRight size={14} strokeWidth={1.5} className="text-ink-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto grid grid-cols-1 gap-4 pt-8 sm:grid-cols-3 sm:gap-5">
        <Feature icon={<ListChecks size={16} strokeWidth={1.5} />} title="逐条对照" note="哪些有依据，哪些还缺" />
        <Feature icon={<Sparkles size={16} strokeWidth={1.5} />} title="调整表达" note="换成岗位看重的角度" />
        <Feature icon={<FileText size={16} strokeWidth={1.5} />} title="生成简历" note="八套版式，导出 PDF" />
      </div>
    </div>
  )
}

/* ---------- 右：经历重写 ---------- */

function RewriteFace({ onBusy }: { onBusy: (b: boolean) => void }) {
  const experiences = useStore((s) => s.library.experiences)
  const events = useStore((s) => s.library.events)
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [dragging, setDragging] = useState(false)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ordered = useMemo(() => byTimeDesc(experiences, (e) => e), [experiences])

  const read = async (file: File) => {
    setError(null)
    setReading(true)
    onBusy(true)
    const r = await readMaterial(file)
    setReading(false)
    onBusy(false)
    if ('error' in r) setError(r.error)
    else navigate('/app/import', { state: { text: r.text, note: r.note, auto: true } })
  }

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <div className="scroll-thin flex h-full flex-col overflow-y-auto p-6 sm:p-9">
      <div className="flex items-center gap-4">
        <Tile size={48}>
          <WandSparkles size={22} strokeWidth={1.5} />
        </Tile>
        <div>
          <h2 className="text-[26px] font-semibold leading-tight tracking-[0.04em]">经历重写</h2>
          <p className="text-[14px] text-ink-3">挖掘经历里的能力和价值，只改表达，不添事实</p>
        </div>
      </div>

      <div className="mt-7 grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 上传 */}
        <div
          className={`flex flex-col items-start rounded-[20px] p-6 transition-[box-shadow,background-color] ${
            dragging ? 'bg-select shadow-[0_0_0_1.5px_var(--color-handle)]' : 'bg-mist/70 shadow-[inset_0_1px_2px_rgb(17_17_17/0.06)]'
          }`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            const f = e.dataTransfer.files[0]
            if (f) void read(f)
          }}
        >
          <Tile size={44}>{reading ? <Loader2 size={18} className="animate-spin" /> : <FileUp size={19} strokeWidth={1.5} />}</Tile>
          <h3 className="mt-5 text-[18px] font-semibold tracking-[0.03em]">上传简历或经历材料</h3>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-3">PDF、TXT、Markdown，拖进来也可以。会自动分到教育、实习、科研、项目等栏目。</p>
          {error && <p className="mt-3 text-[13px] leading-relaxed text-alert">{error}</p>}
          <div className="mt-auto flex flex-wrap gap-2 pt-6">
            <button className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()} disabled={reading}>
              选择文件
            </button>
            <Link to="/app/import" className="btn btn-quiet btn-sm">
              粘贴文字
            </Link>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={MATERIAL_ACCEPT}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void read(f)
              e.target.value = ''
            }}
          />
        </div>

        {/* 从事实库选择 */}
        <div className="flex min-h-[260px] flex-col rounded-[20px] bg-paper p-6 shadow-[0_0_0_1px_rgb(17_17_17/0.07)]">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[18px] font-semibold tracking-[0.03em]">从事实库选择</h3>
            {ordered.length > 1 && (
              <button
                className="text-[13px] text-ink-3 hover:text-ink"
                onClick={() => setPicked(picked.size === ordered.length ? new Set() : new Set(ordered.map((e) => e.id)))}
              >
                {picked.size === ordered.length ? '取消全选' : '全选'}
              </button>
            )}
          </div>
          {ordered.length === 0 ? (
            <div className="flex flex-1 flex-col justify-center text-[13.5px] leading-relaxed text-ink-3">
              事实库还是空的。
              <Link to="/app/chat" className="mt-3 inline-flex items-center gap-1.5 text-ink">
                <MessageCircle size={14} strokeWidth={1.5} />
                <span className="link">和 AI 聊一段经历</span>
              </Link>
            </div>
          ) : (
            <ul className="scroll-thin -mx-2 mt-3 max-h-[220px] min-h-0 flex-1 overflow-y-auto">
              {ordered.map((exp) => {
                const on = picked.has(exp.id)
                const n = events.filter((e) => e.experienceId === exp.id).length
                return (
                  <li key={exp.id}>
                    <button
                      className="flex w-full items-center gap-3 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-mist"
                      onClick={() => toggle(exp.id)}
                      aria-pressed={on}
                    >
                      <span
                        className={`grid size-[18px] shrink-0 place-items-center rounded-full border transition-colors ${on ? 'border-ink bg-ink text-paper' : 'border-rule-2'}`}
                      >
                        {on && <Check size={11} strokeWidth={2.5} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px]">{exp.org || '未命名经历'}</span>
                        <span className="block text-[12px] text-ink-3">
                          {KIND_LABEL[exp.kind]} · <span className="num">{n}</span> 件事
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {ordered.length > 0 && (
            <button className="btn btn-primary btn-sm mt-4 self-start" disabled={picked.size === 0} onClick={() => navigate(`/app/rewrite?exp=${[...picked].join(',')}`)}>
              重写所选{picked.size > 0 && <span className="num opacity-70">{picked.size}</span>}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 pt-8 sm:grid-cols-3 sm:gap-5">
        <Feature icon={<Layers size={16} strokeWidth={1.5} />} title="自动分类" note="识别错了，随手改" />
        <Feature icon={<Sparkles size={16} strokeWidth={1.5} />} title="挖掘价值" note="说出你体现的能力" />
        <Feature icon={<Highlighter size={16} strokeWidth={1.5} />} title="逐处标注" note="每处改动由你决定" />
      </div>
    </div>
  )
}

/* ---------- 页面 ---------- */

export function HomePage() {
  const library = useStore((s) => s.library)
  const jobs = useStore((s) => s.jobs)
  const resumes = useStore((s) => s.resumes)
  const navigate = useNavigate()
  const location = useLocation()
  const navState = location.state as { target?: string; side?: Side } | null
  const target = navState?.target
  const wide = useMedia('(min-width: 900px)')
  const jdRef = useRef<HTMLTextAreaElement>(null)
  const [jd, setJd] = useState('')

  const hasAny = library.experiences.length + library.profile.education.length > 0
  const rewritten = library.events.some((e) => e.variants.some((v) => v.origin === 'ai'))

  // 下一步：按资料的进度推荐一件事
  const step = useMemo(() => {
    if (!hasAny) return { side: 'rewrite' as Side, text: '上传一份旧简历，或者和 AI 聊一段经历', action: '上传简历', to: '/app/import' }
    if (!rewritten)
      return {
        side: 'rewrite' as Side,
        text: `事实库有 ${library.experiences.length} 段经历，让 AI 挖掘其中的价值`,
        action: '开始重写',
        to: `/app/rewrite?exp=${library.experiences.map((e) => e.id).join(',')}`,
      }
    if (jobs.length === 0) return { side: 'job' as Side, text: '经历已经整理好，粘贴一个想投的岗位', action: '粘贴岗位' }
    if (resumes.length === 0) return { side: 'job' as Side, text: `继续「${jobs[0].title || '未识别职位'}」，生成第一份简历`, action: '继续', to: `/app/jobs/${jobs[0].id}` }
    return { side: 'job' as Side, text: `最近的简历：${resumes[0].name}`, action: '打开', to: `/app/resumes/${resumes[0].id}` }
  }, [hasAny, rewritten, library.experiences, jobs, resumes])

  const [open, setOpen] = useState<Side>(navState?.side ?? (target ? 'job' : step.side))
  const [focused, setFocused] = useState<Side | null>(null)
  const [busy, setBusy] = useState<Side | null>(null)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  // 正在输入或处理的一侧不让位：鼠标划到另一侧也不切换
  const locked = busy ?? focused
  const intent = (s: Side) => {
    window.clearTimeout(timer.current)
    if (locked && locked !== s) return
    timer.current = window.setTimeout(() => setOpen(s), 90)
  }
  const expand = (s: Side) => {
    window.clearTimeout(timer.current)
    if (busy && busy !== s) return
    setOpen(s)
  }

  const onStep = () => {
    if (step.to) return
    expand('job')
    window.setTimeout(() => jdRef.current?.focus(), 400)
  }

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className={`mx-auto flex w-full max-w-[1380px] flex-col px-5 pb-8 pt-8 sm:px-8 md:px-10 ${wide ? 'h-full min-h-[680px]' : ''}`}>
        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[13.5px] tracking-[0.16em] text-ink-3">
              {greeting()}
              {library.profile.name && `，${library.profile.name}`}
            </p>
            <h1 className="mt-1.5 text-[clamp(30px,3.4vw,42px)] font-semibold leading-tight tracking-[0.04em]">选一件事开始</h1>
          </div>
          <NextStep action={step.action} to={step.to} onClick={step.to ? undefined : onStep} className="self-start md:self-auto">
            {step.text}
          </NextStep>
        </header>

        <div className={`mt-8 flex gap-5 ${wide ? 'min-h-0 flex-1 flex-row' : 'flex-col'}`}>
          <Panel
            side="job"
            label="适配岗位"
            open={open === 'job'}
            wide={wide}
            onIntent={intent}
            onLeave={() => window.clearTimeout(timer.current)}
            onExpand={expand}
            onFocusChange={setFocused}
            compact={<CompactFace icon={<Target size={26} strokeWidth={1.4} />} title="适配岗位" line="粘贴招聘信息，让简历对准它" scene={<JobScene />} />}
          >
            <JobFace target={target} jd={jd} setJd={setJd} focusRef={jdRef} />
          </Panel>
          <Panel
            side="rewrite"
            label="经历重写"
            open={open === 'rewrite'}
            wide={wide}
            onIntent={intent}
            onLeave={() => window.clearTimeout(timer.current)}
            onExpand={expand}
            onFocusChange={setFocused}
            compact={<CompactFace icon={<WandSparkles size={26} strokeWidth={1.4} />} title="经历重写" line="挖掘经历里的能力和价值" scene={<RewriteScene />} />}
          >
            <RewriteFace onBusy={(b) => setBusy(b ? 'rewrite' : null)} />
          </Panel>
        </div>

        <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-3">
          <button className="group inline-flex items-center gap-2 hover:text-ink" onClick={() => navigate('/app/library')}>
            事实库
            <span className="num text-ink-2">
              {library.experiences.length + library.profile.education.length} 段经历 · {library.events.length} 件事
            </span>
            <ArrowRight size={13} strokeWidth={1.5} className="transition-transform group-hover:translate-x-0.5" />
          </button>
          {resumes.length > 0 && (
            <Link to="/app/resumes" className="group inline-flex items-center gap-2 hover:text-ink">
              已生成 <span className="num text-ink-2">{resumes.length}</span> 份简历
              <ArrowRight size={13} strokeWidth={1.5} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </footer>
      </div>
    </div>
  )
}
