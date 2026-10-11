import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, CornerDownLeft } from 'lucide-react'
import { Brand, BrandMark } from '../components/Brand'
import { seedLibrary } from '../data/seed'
import { assembleResume } from '../lib/assemble'
import { A4, Paper } from '../templates/Paper'
import { ParticleTitle, type ParticleTitleHandle } from './ParticleTitle'
import type { Composition } from './particles'

/** 同一组粒子依次重组成的名称：先是“你的无数种可能”，再依次是各个职业 */
const SEQUENCE: Composition[] = [
  { lines: [{ text: '你的无数种可能' }], narrow: [{ text: '你的', scale: 0.8 }, { text: '无数种可能' }], caption: 'Endless possibilities' },
  { lines: [{ text: '算法架构师' }], caption: 'Algorithm Architect' },
  { lines: [{ text: '后端开发' }], caption: 'Backend Developer' },
  { lines: [{ text: '产品经理' }], caption: 'Product Manager' },
  { lines: [{ text: 'UI设计' }], caption: 'UI Designer' },
  { lines: [{ text: '运营' }], caption: 'Operations' },
]

function splitTarget(text: string): Composition['lines'] {
  const t = text.trim()
  const cjk = /[一-鿿]/.test(t)
  const limit = cjk ? 6 : 12
  if (t.length <= limit) return [{ text: t }]
  const cut = cjk ? Math.ceil(t.length / 2) : Math.max(t.lastIndexOf(' ', Math.ceil(t.length / 2) + 3), Math.ceil(t.length / 2))
  return [
    { text: t.slice(0, cut).trim(), scale: 0.7 },
    { text: t.slice(cut).trim(), scale: 0.7 },
  ]
}

function Header() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <header
      className={`sticky top-0 z-30 transition-[background-color,border-color] duration-300 ${
        scrolled ? 'border-b border-rule bg-paper/90 backdrop-blur-md' : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex h-[72px] max-w-[1200px] items-center gap-10 px-6 md:px-10">
        <Brand />
        <nav className="hidden items-center gap-8 text-[14.5px] text-ink-2 md:flex" aria-label="页面">
          <a href="#how" className="link-reveal hover:text-ink">
            如何运作
          </a>
          <a href="#principle" className="link-reveal hover:text-ink">
            原则
          </a>
        </nav>
        <Link to="/app" className="btn btn-outline btn-sm ml-auto">
          进入工作台
        </Link>
      </div>
    </header>
  )
}

function Hero() {
  const navigate = useNavigate()
  const particles = useRef<ParticleTitleHandle>(null)
  const [caption, setCaption] = useState<string | null>(null)
  const [target, setTarget] = useState('')
  const [chosen, setChosen] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const t = target.trim()
    if (!t) return
    setChosen(t)
    particles.current?.show({ lines: splitTarget(t), caption: 'Your next role' })
    // 粒子在首屏中央重组，确保用户看得到
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }


  return (
    <section className="relative flex min-h-[calc(100dvh-72px)] flex-col">
      <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col items-center px-6 pt-4 md:px-10">
        <p className="animate-fade text-[13px] tracking-[0.32em] text-ink-3">大学生与应届生的简历工作台</p>

        {/* 视觉中心：同一组粒子，重组成不同的岗位 */}
        <ParticleTitle
          ref={particles}
          sequence={SEQUENCE}
          onFormed={(c) => setCaption(c.caption)}
          onScatter={() => setCaption(null)}
          className="mt-2 h-[clamp(190px,30vh,280px)] w-full cursor-crosshair md:h-[clamp(260px,46vh,500px)]"
        />

        <p
          className="h-7 text-[19px] italic tracking-[0.01em] text-ink-2 transition-opacity duration-500"
          style={{ opacity: caption ? 1 : 0 }}
          aria-live="polite"
        >
          {caption ?? ''}
        </p>

        <h1 className="mt-7 text-center text-[clamp(30px,4.2vw,48px)] font-semibold leading-[1.25] tracking-[0.06em] [text-wrap:balance]">
          拾起经历，呈现实力
        </h1>
        <p className="mt-4 max-w-[560px] text-center text-[16.5px] leading-[1.85] text-ink-2 [text-wrap:pretty]">
          你的亮点，不止步于简历。
          <br />
          让AI挖掘你经历中的潜在价值，
          <br className="sm:hidden" />
          为心仪岗位写出更出色的你
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            className="btn btn-primary btn-lg group"
            onClick={() => navigate('/app', chosen ? { state: { target: chosen, side: 'job' } } : undefined)}
          >
            {chosen ? `为「${chosen}」适配简历` : '开始使用'}
            <ArrowRight size={17} strokeWidth={1.5} className="transition-transform group-hover:translate-x-0.5" />
          </button>
          <Link to="/app/import" className="btn btn-outline btn-lg">
            上传旧简历
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-10 flex w-full max-w-[1200px] flex-col items-center gap-4 px-6 pb-8 text-[13px] text-ink-3 md:flex-row md:justify-between md:px-10">
        <span className="hidden md:inline">移动鼠标拨动粒子 · 点击画面换一个岗位</span>
        <form onSubmit={submit} className="flex items-center gap-3">
          <label htmlFor="target" className="whitespace-nowrap">
            试试你的目标岗位
          </label>
          <span className="relative">
            <input
              id="target"
              className="input-line w-[180px] pr-7 text-[15px] text-ink"
              placeholder="例如：产品运营"
              maxLength={14}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              autoComplete="off"
            />
            <button
              type="submit"
              className="absolute right-0 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink disabled:opacity-0"
              disabled={!target.trim()}
              aria-label="用粒子组成这个岗位"
            >
              <CornerDownLeft size={15} strokeWidth={1.5} />
            </button>
          </span>
        </form>
      </div>
    </section>
  )
}

/* ---------- 如何运作：三个步骤，各配一个产品里的真实片段 ---------- */

function SortVignette() {
  const rows: { cat: string; org: string; date: string }[] = [
    { cat: '教育背景', org: '虚构示例大学', date: '2023–2027' },
    { cat: '实习经历', org: '星野科技', date: '2026' },
    { cat: '科研经历', org: '信息行为实验室', date: '2025' },
    { cat: '项目经历', org: '南风书店小程序', date: '2025' },
  ]
  return (
    <div className="flex h-full flex-col justify-center gap-2.5 rounded-[18px] bg-[linear-gradient(180deg,#fafafa,#fff)] p-5 shadow-[0_0_0_1px_rgb(17_17_17/0.06)]">
      {rows.map((r, i) => (
        <div
          key={r.org}
          className={`flex items-center gap-3 rounded-[12px] bg-white px-3.5 py-2.5 text-[13px] shadow-[0_0_0_1px_rgb(17_17_17/0.07),0_6px_16px_-12px_rgb(17_17_17/0.35)] ${i === 2 ? 'translate-x-2 shadow-[0_0_0_1.5px_var(--color-handle),0_10px_24px_-14px_rgb(17_17_17/0.4)]' : ''}`}
        >
          <span className="select-pill pointer-events-none !h-6 shrink-0 !text-[11.5px] leading-6">{r.cat}</span>
          <span className="min-w-0 flex-1 truncate">{r.org}</span>
          <span className="num shrink-0 text-[11.5px] text-ink-3">{r.date}</span>
        </div>
      ))}
    </div>
  )
}

function RewriteVignette() {
  return (
    <div className="relative flex h-full flex-col justify-center rounded-[18px] bg-[linear-gradient(180deg,#fafafa,#fff)] px-6 py-5 shadow-[0_0_0_1px_rgb(17_17_17/0.06)]">
      <div className="mx-auto mb-3 inline-flex self-center">
        <div className="callout !h-[28px] !text-[12px]">
          <span className="grid place-items-center px-3">采纳</span>
          <span className="grid place-items-center px-3 shadow-[inset_1px_0_0_rgb(255_255_255/0.18)]">保留原文</span>
        </div>
      </div>
      <p className="text-[14.5px] leading-[2.05]">
        对 312 份问卷数据
        <span className="diff-del">进行了清洗，然后</span>
        <span className="diff-ins">完成清洗并剔除无效样本，</span>
        用 SPSS 做描述统计
        <span className="diff-ins">与交叉分析</span>
        <span className="diff-del">做了一些</span>。
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5 border-t border-rule pt-3">
        <span className="label mr-1">体现了</span>
        {['数据分析', '科研能力'].map((t) => (
          <span key={t} className="rounded-full bg-mist px-2.5 py-0.5 text-[12px] text-ink-2">
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

function PaperVignette() {
  const resume = useMemo(
    () =>
      assembleResume({
        library: seedLibrary,
        template: 'dense',
        picks: [
          { eventId: 'ev_xingye_interview', variantId: 'va_interview_research' },
          { eventId: 'ev_xingye_data', variantId: 'va_data_analysis' },
          { eventId: 'ev_xingye_prd', variantId: 'va_prd_product' },
          { eventId: 'ev_nanfeng_research', variantId: 'va_nanfeng_research_product' },
          { eventId: 'ev_nanfeng_proto', variantId: 'va_nanfeng_proto_product' },
        ],
      }),
    [],
  )
  const scale = 0.34
  return (
    <div className="flex h-full items-center justify-center overflow-hidden rounded-[18px] bg-[linear-gradient(180deg,#fafafa,#fff)] shadow-[0_0_0_1px_rgb(17_17_17/0.06)] [perspective:900px]">
      <div className="paper-shadow overflow-hidden rounded-[2px] [transform:rotateX(10deg)]" style={{ width: A4.width * scale, height: A4.height * scale * 0.66 }}>
        <div className="pointer-events-none origin-top-left" style={{ transform: `scale(${scale})` }}>
          <Paper resume={resume} />
        </div>
      </div>
    </div>
  )
}

const STEPS = [
  {
    n: '1',
    title: '整理经历',
    text: '上传旧简历，或者和 AI 聊一段。自动分到教育、实习、科研、项目等栏目，分错了随手改。',
    vignette: <SortVignette />,
  },
  {
    n: '2',
    title: '经历重写',
    text: 'AI 从你做过的事里挖掘能力和价值。每处修改都标出来：删去的划掉，新写的加粗，采纳与否由你决定。',
    vignette: <RewriteVignette />,
  },
  {
    n: '3',
    title: '适配岗位',
    text: '粘贴招聘信息，逐条对照要求，按岗位调整表达的角度和重点，再从八套版式里选一套生成简历。',
    vignette: <PaperVignette />,
  },
]

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 border-t border-rule">
      <div className="mx-auto max-w-[1200px] px-6 py-24 md:px-10 md:py-32">
        <div className="max-w-[820px]">
          <p className="text-[13px] tracking-[0.32em] text-ink-3">如何运作</p>
          <h2 className="mt-4 text-[clamp(28px,3.4vw,40px)] font-semibold leading-[1.3] tracking-[0.03em] [text-wrap:balance]">从一段经历，到一份对准岗位的简历</h2>
        </div>
        <ol className="mt-16 grid gap-14 md:grid-cols-3 md:gap-10">
          {STEPS.map((s) => (
            <li key={s.n} className="flex flex-col">
              <div className="flex items-baseline gap-4">
                <span className="text-[44px] font-light italic leading-none text-ink-4">{s.n}</span>
                <h3 className="text-[21px] font-semibold tracking-[0.03em]">{s.title}</h3>
              </div>
              <p className="mt-4 min-h-[84px] text-[15px] leading-[1.85] text-ink-2">{s.text}</p>
              <div className="mt-6 h-[288px]">{s.vignette}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ---------- 原则 ---------- */

function Principle() {
  const points = [
    { title: '每处修改都看得见', text: '重写不是整段替换。删去的、新写的分别标出来，可以逐处采纳，也可以保留原文继续编辑。' },
    { title: '数字，必须有出处', text: '改写里出现事实库没有的数字，会立刻提醒你补上来源，或者删掉。' },
    { title: '每份简历都是快照', text: '之后修改事实库，不会悄悄改动已经投出去的那一份。' },
  ]
  return (
    <section id="principle" className="scroll-mt-20 border-t border-rule">
      <div className="mx-auto grid max-w-[1200px] gap-16 px-6 py-24 md:grid-cols-[1.1fr_1fr] md:px-10 md:py-32">
        <div>
          <p className="text-[13px] tracking-[0.32em] text-ink-3">原则</p>
          <h2 className="mt-4 text-[clamp(34px,4.6vw,56px)] font-semibold leading-[1.22] tracking-[0.04em]">
            挖掘价值，
            <br />
            不编造经历。
          </h2>
          <div className="mt-12 max-w-[460px] border-l-2 border-ink pl-5 text-[16px] leading-[1.9]">
            整理 12 位同学的访谈记录，分析效率提升 <span className="rounded-[3px] bg-alert-wash px-1 font-semibold text-alert">40%</span>
            <p className="mt-2 text-[13px] text-alert">事实库里找不到“40%”这个数字</p>
          </div>
        </div>
        <ul className="divide-y divide-rule self-start border-y border-rule md:mt-16">
          {points.map((p) => (
            <li key={p.title} className="py-7">
              <h3 className="text-[18px] font-semibold tracking-[0.03em]">{p.title}</h3>
              <p className="mt-2 text-[15px] leading-[1.85] text-ink-2">{p.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Closing() {
  return (
    <section className="border-t border-rule">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center px-6 py-28 text-center md:px-10 md:py-36">
        <BrandMark size={72} className="mb-8" />
        <h2 className="text-[clamp(30px,4vw,48px)] font-semibold tracking-[0.06em]">拾起经历，呈现实力</h2>
        <p className="mt-4 text-[16px] text-ink-2">实习、科研、课程项目、社团，都算。</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link to="/app" className="btn btn-primary btn-lg group">
            进入工作台
            <ArrowRight size={17} strokeWidth={1.5} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link to="/app/chat" className="btn btn-outline btn-lg">
            和 AI 聊一段
          </Link>
        </div>
      </div>
      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-6 py-8 text-[13px] text-ink-3 md:flex-row md:justify-between md:px-10">
          <span>拾历 · 资料只保存在你的浏览器里</span>
          <span className="num">© 2026</span>
        </div>
      </footer>
    </section>
  )
}

export function LandingPage() {
  useEffect(() => {
    document.title = '拾历 · 拾起经历，呈现实力'
    return () => {
      document.title = '拾历 · 简历工作台'
    }
  }, [])
  return (
    <div className="min-h-dvh bg-paper">
      <Header />
      <Hero />
      <HowItWorks />
      <Principle />
      <Closing />
    </div>
  )
}
