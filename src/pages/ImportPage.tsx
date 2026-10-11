import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ArrowLeft, ArrowRight, Check, FileUp, Loader2, Plus, Sparkles, Target, X } from 'lucide-react'
import { useStore, type ImportBatch } from '../store/store'
import { ai, useAi } from '../lib/ai'
import type { ParsedEntry, ParsedResume } from '../lib/ai/types'
import { CATEGORY_LABEL, CATEGORY_ORDER, EMPLOYMENT_LABEL, KIND_TYPES, type Category, type Event, type Experience } from '../lib/schema'
import { uid } from '../lib/ids'
import { MATERIAL_ACCEPT, readMaterial } from '../lib/readFile'
import { SAMPLE_RESUME } from '../data/sampleResume'
import { AutoTextarea } from '../components/ui'
import { NextStep } from '../components/NextStep'

type Stage = 'input' | 'review' | 'done'

const emptyEntry = (category: Category): ParsedEntry => ({
  id: uid(category === 'education' ? 'edu' : 'exp'),
  category,
  reason: '手动添加',
  org: '',
  role: '',
  degree: category === 'education' ? '本科' : '',
  employmentType: category === 'education' ? 'full-time' : KIND_TYPES[category][0],
  start: '',
  end: '',
  details: '',
  rawText: '',
  items: [],
})

/** 改分类时，同步把性质换成新栏目的默认值；教育背景和经历之间互转时搬运内容 */
function recategorize(e: ParsedEntry, category: Category): ParsedEntry {
  if (category === e.category) return e
  const next: ParsedEntry = { ...e, category, reason: '你手动调整' }
  if (category === 'education') {
    next.details = [e.details, ...e.items.map((i) => (i.lead ? `${i.lead}：${i.text}` : i.text))].filter(Boolean).join('；')
    next.items = []
    next.employmentType = 'full-time'
  } else {
    if (e.category === 'education' && e.details) {
      next.items = e.details
        .split(/[；;\n]/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => ({ id: uid('it'), lead: '', text: t }))
      next.details = ''
    }
    if (!KIND_TYPES[category].includes(e.employmentType)) next.employmentType = KIND_TYPES[category][0]
  }
  return next
}

function CategorySelect({ value, onChange }: { value: Category; onChange: (c: Category) => void }) {
  return (
    <select className="select-pill" value={value} onChange={(e) => onChange(e.target.value as Category)} aria-label="分类">
      {CATEGORY_ORDER.map((c) => (
        <option key={c} value={c}>
          {CATEGORY_LABEL[c]}
        </option>
      ))}
    </select>
  )
}

function EntryCard({
  entry,
  onChange,
  onRemove,
  onHover,
  flash,
}: {
  entry: ParsedEntry
  onChange: (e: ParsedEntry) => void
  onRemove: () => void
  onHover: (raw: string | null) => void
  flash: boolean
}) {
  const edu = entry.category === 'education'
  const set = (patch: Partial<ParsedEntry>) => onChange({ ...entry, ...patch })
  const setItem = (id: string, patch: Partial<ParsedEntry['items'][number]>) => set({ items: entry.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })
  return (
    <article
      id={`entry-${entry.id}`}
      className={`group/card rounded-[18px] bg-paper p-5 shadow-[0_0_0_1px_rgb(17_17_17/0.07),0_10px_30px_-24px_rgb(17_17_17/0.3)] transition-shadow hover:shadow-[0_0_0_1px_rgb(17_17_17/0.14),0_14px_34px_-22px_rgb(17_17_17/0.32)] ${flash ? 'animate-flash' : ''}`}
      onMouseEnter={() => onHover(entry.rawText || null)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="flex items-center gap-3">
        <CategorySelect value={entry.category} onChange={(c) => onChange(recategorize(entry, c))} />
        {!edu && KIND_TYPES[entry.category as Exclude<Category, 'education'>].length > 1 && (
          <select
            className="select-pill"
            value={entry.employmentType}
            onChange={(e) => set({ employmentType: e.target.value as ParsedEntry['employmentType'] })}
            aria-label="性质"
          >
            {KIND_TYPES[entry.category as Exclude<Category, 'education'>].map((t) => (
              <option key={t} value={t}>
                {EMPLOYMENT_LABEL[t]}
              </option>
            ))}
          </select>
        )}
        <span className="min-w-0 flex-1 truncate text-[12px] text-ink-4" title={entry.reason}>
          {entry.reason}
        </span>
        <button className="grid size-7 place-items-center rounded-full text-ink-4 transition-colors hover:bg-mist hover:text-ink" onClick={onRemove} aria-label="不导入这一条" title="不导入这一条">
          <X size={14} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-x-5 gap-y-3">
        <input
          className="input-line text-[17px] font-semibold"
          placeholder={edu ? '学校' : entry.category === 'project' ? '项目名称' : '机构'}
          value={entry.org}
          onChange={(e) => set({ org: e.target.value })}
          aria-label={edu ? '学校' : '机构'}
        />
        <input
          className="input-line"
          placeholder={edu ? '专业' : '职位或角色'}
          value={entry.role}
          onChange={(e) => set({ role: e.target.value })}
          aria-label={edu ? '专业' : '职位'}
        />
        <div className="flex items-center gap-2">
          <input className="input-line num" placeholder="开始 2025.07" value={entry.start} onChange={(e) => set({ start: e.target.value })} aria-label="开始" />
          <span className="text-ink-4">–</span>
          <input className="input-line num" placeholder="结束 / 至今" value={entry.end} onChange={(e) => set({ end: e.target.value })} aria-label="结束" />
        </div>
        {edu && <input className="input-line" placeholder="学历" value={entry.degree} onChange={(e) => set({ degree: e.target.value })} aria-label="学历" />}
      </div>

      {edu ? (
        <AutoTextarea
          className="input-line mt-3 w-full text-[14px] text-ink-2"
          placeholder="补充：GPA、主修课程、排名（可以留空）"
          value={entry.details}
          onChange={(e) => set({ details: e.target.value })}
          aria-label="补充"
        />
      ) : (
        <ul className="mt-4 space-y-1.5">
          {entry.items.map((it) => (
            <li key={it.id} className="group/item flex items-start gap-2.5">
              <span className="mt-[13px] h-px w-3 shrink-0 bg-ink-4" aria-hidden />
              <div className="min-w-0 flex-1 text-[14.5px] leading-[1.75]">
                <input
                  className="inline-edit w-full font-semibold placeholder:font-normal"
                  placeholder="概括（可以留空）"
                  value={it.lead}
                  onChange={(e) => setItem(it.id, { lead: e.target.value })}
                  aria-label="概括"
                />
                <AutoTextarea className="inline-edit w-full text-ink-2" value={it.text} onChange={(e) => setItem(it.id, { text: e.target.value })} aria-label="内容" />
              </div>
              <button
                className="mt-1 text-ink-4 opacity-0 transition-opacity hover:text-ink focus:opacity-100 group-hover/item:opacity-100"
                onClick={() => set({ items: entry.items.filter((i) => i.id !== it.id) })}
                aria-label="删除这一件事"
              >
                <X size={14} />
              </button>
            </li>
          ))}
          <li>
            <button
              className="inline-flex items-center gap-1 pl-5 text-[13px] text-ink-3 hover:text-ink"
              onClick={() => set({ items: [...entry.items, { id: uid('it'), lead: '', text: '' }] })}
            >
              <Plus size={13} strokeWidth={1.5} />
              {entry.items.length ? '再加一件事' : '这段经历里做了什么'}
            </button>
          </li>
        </ul>
      )}
    </article>
  )
}

/** 把核对后的条目变成事实库里的记录 */
function toBatch(parsed: ParsedResume, useContacts: boolean): ImportBatch {
  const now = Date.now()
  const batch: ImportBatch = {
    experiences: [],
    events: [],
    education: [],
    honors: parsed.honors.filter((h) => h.title.trim()),
    skills: parsed.skills.filter((s) => s.items.length),
    contacts: useContacts ? parsed.contacts : undefined,
  }
  for (const e of parsed.entries) {
    if (!e.org.trim() && !e.items.length && !e.details.trim()) continue
    if (e.category === 'education') {
      batch.education.push({ id: e.id, school: e.org.trim(), degree: e.degree.trim(), major: e.role.trim(), start: e.start, end: e.end, details: e.details.trim() })
      continue
    }
    const exp: Experience = {
      id: e.id,
      kind: e.category,
      org: e.org.trim() || '未命名经历',
      role: e.role.trim(),
      employmentType: e.employmentType,
      start: e.start,
      end: e.end,
      summary: '',
      rawText: e.rawText,
      version: 1,
      updatedAt: now,
    }
    batch.experiences.push(exp)
    for (const it of e.items) {
      const text = it.text.trim()
      if (!text) continue
      const ev: Event = {
        id: uid('ev'),
        experienceId: exp.id,
        title: (it.lead || text.replace(/[，。；,;].*$/, '')).slice(0, 16),
        background: '',
        action: text,
        result: '',
        metrics: text.match(/\d+(?:\.\d+)?\s*(?:%|个|位|份|篇|次|场|人|万|小时|天|周|项|条|页|家)/g) ?? [],
        signals: [],
        contribution: '',
        evidence: 'self',
        sourceNote: '导入的材料',
        variants: [{ id: uid('va'), angle: '原文', lead: it.lead.trim(), text, origin: 'import', createdAt: now }],
        version: 1,
        updatedAt: now,
      }
      batch.events.push(ev)
    }
  }
  return batch
}

export function ImportPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const incoming = location.state as { text?: string; note?: string; auto?: boolean } | null
  const importBatch = useStore((s) => s.importBatch)
  const existing = useStore((s) => s.library.experiences.length)
  const fileRef = useRef<HTMLInputElement>(null)
  const remote = useAi((s) => s.status?.configured)

  const [stage, setStage] = useState<Stage>('input')
  const [text, setText] = useState(incoming?.text ?? '')
  const [notice, setNotice] = useState<string | null>(incoming?.note ?? null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [parsed, setParsed] = useState<ParsedResume | null>(null)
  const [useContacts, setUseContacts] = useState(true)
  const [hoverRaw, setHoverRaw] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [saved, setSaved] = useState<ImportBatch | null>(null)

  const parse = async (source = text) => {
    if (!source.trim()) return
    setBusy(true)
    try {
      const r = await ai.parseResume(source)
      if (r.entries.length === 0) {
        setNotice('没有识别出经历。每段经历最好单独一行写机构和时间，例如“星野科技 产品实习生 2025.07-2025.10”。')
        return
      }
      setParsed(r)
      setStage('review')
    } finally {
      setBusy(false)
    }
  }

  // 从首页上传过来：直接拆分
  useEffect(() => {
    if (incoming?.auto && incoming.text) void parse(incoming.text)
    if (incoming) navigate(location.pathname, { replace: true, state: null })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const readFile = async (file: File) => {
    setNotice(null)
    setBusy(true)
    const r = await readMaterial(file)
    setBusy(false)
    if ('error' in r) return setNotice(r.error)
    setText(r.text)
    setNotice(`${r.note}。看一眼有没有错行，再开始拆分。`)
  }

  const setEntry = (e: ParsedEntry) => {
    const prev = parsed?.entries.find((x) => x.id === e.id)
    if (prev && prev.category !== e.category) {
      // 换了栏目：卡片会移到新的分组，滚过去并闪一下，让人知道它去了哪里
      setFlash(e.id)
      window.setTimeout(() => document.getElementById(`entry-${e.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
      window.setTimeout(() => setFlash(null), 1500)
    }
    setParsed((p) => p && { ...p, entries: p.entries.map((x) => (x.id === e.id ? e : x)) })
  }

  const groups = useMemo(
    () => (parsed ? CATEGORY_ORDER.map((c) => ({ c, items: parsed.entries.filter((e) => e.category === c) })) : []),
    [parsed],
  )

  const commit = () => {
    if (!parsed) return
    const batch = toBatch(parsed, useContacts)
    importBatch(batch)
    setSaved(batch)
    setStage('done')
  }

  /* ---------- 完成 ---------- */
  if (stage === 'done' && saved) {
    const counts = CATEGORY_ORDER.map((c) => ({
      c,
      n: c === 'education' ? saved.education.length : saved.experiences.filter((e) => e.kind === c).length,
    })).filter((x) => x.n)
    const expIds = saved.experiences.map((e) => e.id)
    return (
      <div key="done" className="scroll-thin h-full overflow-y-auto">
        <div className="mx-auto flex max-w-[760px] flex-col items-center px-8 pb-24 pt-20 text-center">
          <span className="tile-3d animate-pop" style={{ width: 64, height: 64, borderRadius: 20 }}>
            <Check size={28} strokeWidth={1.6} />
          </span>
          <h1 className="mt-7 text-[34px] font-semibold tracking-[0.04em]">已保存到事实库</h1>
          <p className="mt-3 text-[15.5px] text-ink-2">
            {counts.map((x, i) => (
              <span key={x.c}>
                {i > 0 && <span className="mx-2 text-ink-4">·</span>}
                {CATEGORY_LABEL[x.c]} <span className="num font-semibold text-ink">{x.n}</span>
              </span>
            ))}
            <span className="mx-2 text-ink-4">·</span>共 <span className="num font-semibold text-ink">{saved.events.length}</span> 件事
          </p>

          <div className="mt-12 grid w-full gap-4 text-left sm:grid-cols-2">
            <button
              className="group panel-3d flex flex-col items-start p-7 text-left transition-transform duration-300 hover:-translate-y-0.5"
              onClick={() => navigate(`/app/rewrite?exp=${expIds.join(',')}`)}
              disabled={!expIds.length}
            >
              <span className="tile-3d" style={{ width: 44, height: 44, borderRadius: 13 }}>
                <Sparkles size={19} strokeWidth={1.5} />
              </span>
              <span className="mt-5 text-[19px] font-semibold tracking-[0.03em]">让 AI 重写这些经历</span>
              <span className="mt-1 text-[13.5px] text-ink-3">挖掘能力和价值，每处修改都标出来</span>
              <span className="mt-5 inline-flex items-center gap-1 text-[13.5px] text-ink">
                推荐的下一步 <ArrowRight size={14} strokeWidth={1.6} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
            <button className="group panel-3d flex flex-col items-start p-7 text-left transition-transform duration-300 hover:-translate-y-0.5" onClick={() => navigate('/app', { state: { side: 'job' } })}>
              <span className="tile-3d" style={{ width: 44, height: 44, borderRadius: 13 }}>
                <Target size={19} strokeWidth={1.5} />
              </span>
              <span className="mt-5 text-[19px] font-semibold tracking-[0.03em]">直接适配一个岗位</span>
              <span className="mt-1 text-[13.5px] text-ink-3">粘贴招聘信息，生成定制简历</span>
              <span className="mt-5 inline-flex items-center gap-1 text-[13.5px] text-ink-2">
                去粘贴岗位 <ArrowRight size={14} strokeWidth={1.6} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          </div>
          <Link to={expIds[0] ? `/app/library/${expIds[0]}` : '/app/library?section=education'} className="link-reveal mt-8 text-[14px] text-ink-3 hover:text-ink">
            在事实库里查看和修改
          </Link>
        </div>
      </div>
    )
  }

  /* ---------- 核对 ---------- */
  if (stage === 'review' && parsed) {
    const hasContacts = parsed.contacts.name || parsed.contacts.phone || parsed.contacts.email
    const total = parsed.entries.length
    const eventCount = parsed.entries.reduce((n, e) => n + e.items.filter((i) => i.text.trim()).length, 0)
    const lines = text.split('\n')
    const rawLines = new Set((hoverRaw ?? '').split('\n').map((l) => l.trim()).filter(Boolean))
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-4 border-b border-rule px-8 py-4">
          <button className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-mist hover:text-ink" onClick={() => setStage('input')} aria-label="返回修改原文">
            <ArrowLeft size={18} strokeWidth={1.5} />
          </button>
          <div className="flex-1">
            <div className="text-[19px] font-semibold tracking-[0.03em]">核对拆分结果</div>
            <div className="text-[13px] text-ink-3">分类和内容都可以直接改，改完再保存</div>
          </div>
          <span className="hidden text-[13px] text-ink-3 lg:inline">
            {groups
              .filter((g) => g.items.length)
              .map((g) => `${CATEGORY_LABEL[g.c].replace('经历', '').replace('背景', '')} ${g.items.length}`)
              .join(' · ')}
          </span>
          <button className="btn btn-primary" onClick={commit} disabled={total === 0}>
            保存到事实库
            <span className="num text-[12.5px] opacity-70">
              {total} 段 · {eventCount} 件
            </span>
          </button>
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="scroll-thin w-[38%] overflow-y-auto border-r border-rule px-9 py-8">
            <p className="label mb-3">原文 · 指向右侧条目时高亮对应的行</p>
            <div className="font-serif text-[14px] leading-[1.95] text-ink-2">
              {lines.map((l, i) => (
                <div
                  key={i}
                  className={`-mx-2 whitespace-pre-wrap rounded-[4px] px-2 transition-colors duration-200 ${l.trim() && rawLines.has(l.trim()) ? 'bg-select text-ink' : ''}`}
                >
                  {l || ' '}
                </div>
              ))}
            </div>
          </div>
          <div className="scroll-thin min-w-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,#fafafa,#fff_240px)] px-9 py-8">
            <div className="mx-auto max-w-[680px] space-y-10">
              {hasContacts && (
                <label className="flex cursor-pointer items-start gap-3 text-[14.5px]">
                  <input type="checkbox" className="mt-1.5 accent-ink" checked={useContacts} onChange={(e) => setUseContacts(e.target.checked)} />
                  <span>
                    用识别到的联系方式更新个人信息
                    <span className="mt-0.5 block text-[13.5px] text-ink-3">{[parsed.contacts.name, parsed.contacts.phone, parsed.contacts.email].filter(Boolean).join('  ·  ')}</span>
                  </span>
                </label>
              )}
              {groups.map((g) =>
                g.items.length === 0 ? null : (
                  <section key={g.c}>
                    <div className="mb-3 flex items-baseline justify-between">
                      <h2 className="text-[18px] font-semibold tracking-[0.06em]">
                        {CATEGORY_LABEL[g.c]}
                        <sup className="num ml-1 text-[11px] font-normal text-ink-3">{g.items.length}</sup>
                      </h2>
                      <button
                        className="inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink"
                        onClick={() => setParsed((p) => p && { ...p, entries: [...p.entries, emptyEntry(g.c)] })}
                      >
                        <Plus size={13} strokeWidth={1.5} />
                        添加
                      </button>
                    </div>
                    <div className="space-y-4">
                      {g.items.map((e) => (
                        <EntryCard
                          key={e.id}
                          entry={e}
                          flash={flash === e.id}
                          onChange={setEntry}
                          onRemove={() => setParsed((p) => p && { ...p, entries: p.entries.filter((x) => x.id !== e.id) })}
                          onHover={setHoverRaw}
                        />
                      ))}
                    </div>
                  </section>
                ),
              )}
              {(parsed.honors.length > 0 || parsed.skills.length > 0) && (
                <section>
                  <h2 className="mb-3 text-[18px] font-semibold tracking-[0.06em]">荣誉与技能</h2>
                  <div className="space-y-2 rounded-[18px] bg-paper p-5 text-[14.5px] shadow-[0_0_0_1px_rgb(17_17_17/0.07)]">
                    {parsed.honors.map((h) => (
                      <div key={h.id} className="group/h flex items-center gap-3">
                        <span className="label w-10 shrink-0">荣誉</span>
                        <input
                          className="inline-edit min-w-0 flex-1"
                          value={h.title}
                          onChange={(e) => setParsed((p) => p && { ...p, honors: p.honors.map((x) => (x.id === h.id ? { ...x, title: e.target.value } : x)) })}
                          aria-label="荣誉名称"
                        />
                        <input
                          className="inline-edit num w-20 text-right text-ink-3"
                          value={h.date}
                          placeholder="时间"
                          onChange={(e) => setParsed((p) => p && { ...p, honors: p.honors.map((x) => (x.id === h.id ? { ...x, date: e.target.value } : x)) })}
                          aria-label="时间"
                        />
                        <button className="text-ink-4 opacity-0 hover:text-ink group-hover/h:opacity-100" onClick={() => setParsed((p) => p && { ...p, honors: p.honors.filter((x) => x.id !== h.id) })} aria-label="不导入">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    {parsed.skills.map((s) => (
                      <div key={s.id} className="group/h flex items-center gap-3">
                        <span className="label w-10 shrink-0">技能</span>
                        <input
                          className="inline-edit w-20 shrink-0 font-semibold"
                          value={s.label}
                          onChange={(e) => setParsed((p) => p && { ...p, skills: p.skills.map((x) => (x.id === s.id ? { ...x, label: e.target.value } : x)) })}
                          aria-label="技能分组"
                        />
                        <input
                          className="inline-edit min-w-0 flex-1 text-ink-2"
                          value={s.items.join('、')}
                          onChange={(e) =>
                            setParsed((p) => p && { ...p, skills: p.skills.map((x) => (x.id === s.id ? { ...x, items: e.target.value.split(/[、,，]/).map((t) => t.trim()) } : x)) })
                          }
                          aria-label="技能"
                        />
                        <button className="text-ink-4 opacity-0 hover:text-ink group-hover/h:opacity-100" onClick={() => setParsed((p) => p && { ...p, skills: p.skills.filter((x) => x.id !== s.id) })} aria-label="不导入">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule pt-5 text-[13px] text-ink-3">
                <span>漏了一段？</span>
                {CATEGORY_ORDER.filter((c) => !groups.find((g) => g.c === c)?.items.length).map((c) => (
                  <button key={c} className="inline-flex items-center gap-1 hover:text-ink" onClick={() => setParsed((p) => p && { ...p, entries: [...p.entries, emptyEntry(c)] })}>
                    <Plus size={12} strokeWidth={1.5} />
                    {CATEGORY_LABEL[c]}
                  </button>
                ))}
                <span className="ml-auto">
                  已有的 <span className="num">{existing}</span> 段经历不会被覆盖
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ---------- 输入 ---------- */
  return (
    <div key="input" className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-[780px] px-8 pb-20 pt-12">
        <p className="label">经历重写 · 第一步</p>
        <h1 className="mt-1.5 text-[32px] font-semibold leading-tight tracking-[0.04em]">导入简历或经历材料</h1>
        <p className="mt-2 text-[15px] text-ink-3">自动拆成一段段经历，分到教育、实习、科研、项目等栏目</p>

        <div
          className={`mt-8 overflow-hidden rounded-[22px] transition-shadow ${
            dragging ? 'shadow-[0_0_0_1.5px_var(--color-handle)]' : 'shadow-[0_0_0_1px_rgb(17_17_17/0.1)] focus-within:shadow-[0_0_0_1.5px_var(--color-ink)]'
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
            if (f) void readFile(f)
          }}
        >
          <div className="flex items-center gap-4 border-b border-rule px-5 py-3">
            <button className="btn btn-quiet btn-sm" onClick={() => fileRef.current?.click()} disabled={busy}>
              <FileUp size={14} strokeWidth={1.5} />
              选择文件
            </button>
            <span className="text-[13px] text-ink-3">文字型 PDF、TXT、Markdown，也可以拖进来</span>
            <button className="link-reveal ml-auto text-[13px] text-ink-3 hover:text-ink" onClick={() => setText(SAMPLE_RESUME)}>
              填入虚构示例
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={MATERIAL_ACCEPT}
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void readFile(f)
                e.target.value = ''
              }}
            />
          </div>
          <textarea
            className="block min-h-[380px] w-full resize-y bg-transparent px-6 py-5 text-[15px] leading-[1.95] outline-none"
            placeholder={'或者直接粘贴简历、经历描述。\n带上“教育背景”“实习经历”这样的标题，分类会更准。'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="简历文字"
          />
        </div>
        {notice && <p className="mt-4 text-[14px] leading-relaxed text-ink-2">{notice}</p>}
        {busy && remote && <p className="mt-4 text-[13.5px] text-ink-3">DeepSeek 正在阅读和分类，内容多时大约需要 20 秒…</p>}
        <div className="mt-6 flex items-center justify-between gap-4">
          <NextStep label="接下来">拆分后逐条核对，确认分类再保存</NextStep>
          <button className="btn btn-primary" disabled={!text.trim() || busy} onClick={() => parse()}>
            {busy && <Loader2 size={14} className="animate-spin" />}
            拆分并分类
          </button>
        </div>
        <p className="mt-8 text-[13px] text-ink-3">
          没有现成的简历？
          <Link to="/app/chat" className="link ml-1 text-ink">
            和 AI 聊一段经历
          </Link>
        </p>
      </div>
    </div>
  )
}
