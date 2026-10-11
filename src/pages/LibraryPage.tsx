import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Lightbulb, Plus, Search, Sparkles } from 'lucide-react'
import { useStore } from '../store/store'
import { CATEGORY_LABEL, CATEGORY_ORDER, EMPLOYMENT_LABEL, KIND_LABEL, KIND_ORDER, KIND_TYPES, type Category, type Experience, type ExperienceKind } from '../lib/schema'
import { byTimeDesc, dateRange, experienceHeading, roleLine } from '../lib/format'
import { suggestCategory } from '../lib/classify'
import { uid } from '../lib/ids'
import { useDismiss } from '../lib/useDismiss'
import { AutoTextarea, Field, TextButton } from '../components/ui'
import { NextStep } from '../components/NextStep'
import { EventSection } from '../board/EventSection'
import { EducationPanel, HonorsPanel, ProfilePanel, SkillsPanel } from '../board/LibraryPanels'

type Section = 'profile' | 'education' | 'honor' | 'skill'

function newExperience(kind: ExperienceKind): Experience {
  return {
    id: uid('exp'),
    kind,
    org: '',
    role: '',
    employmentType: KIND_TYPES[kind][0],
    start: '',
    end: '',
    summary: '',
    rawText: '',
    version: 1,
    updatedAt: Date.now(),
  }
}

/** 改栏目：经历之间直接改；改成教育背景时转成教育条目 */
function useRecategorize() {
  const upsert = useStore((s) => s.upsertExperience)
  const toEducation = useStore((s) => s.experienceToEducation)
  const events = useStore((s) => s.library.events)
  const navigate = useNavigate()
  return useCallback(
    (exp: Experience, c: Category) => {
      if (c === exp.kind) return
      if (c === 'education') {
        const n = events.filter((e) => e.experienceId === exp.id).length
        if (n && !confirm(`移到教育背景后，其中 ${n} 件事会并入“补充”说明。继续？`)) return
        const id = toEducation(exp.id)
        if (id) navigate(`/app/library?section=education&edu=${id}`)
        return
      }
      upsert({ ...exp, kind: c, employmentType: KIND_TYPES[c].includes(exp.employmentType) ? exp.employmentType : KIND_TYPES[c][0] })
    },
    [upsert, toEducation, events, navigate],
  )
}

function CategoryPill({ exp }: { exp: Experience }) {
  const recategorize = useRecategorize()
  return (
    <select className="select-pill" value={exp.kind} onChange={(e) => recategorize(exp, e.target.value as Category)} aria-label="栏目">
      {CATEGORY_ORDER.map((c) => (
        <option key={c} value={c}>
          {c === 'education' ? '移到教育背景' : CATEGORY_LABEL[c]}
        </option>
      ))}
    </select>
  )
}

/* ---------- 左侧索引：像一本书的目录 ---------- */

function IndexItem({ active, onClick, title, sub, note }: { active: boolean; onClick: () => void; title: string; sub?: string; note?: string }) {
  return (
    <button
      onClick={onClick}
      className={`relative block w-full rounded-r-md py-2.5 pl-5 pr-3 text-left transition-colors ${active ? 'text-ink' : 'text-ink-2 hover:bg-mist hover:text-ink'}`}
      aria-current={active ? 'page' : undefined}
    >
      <span className={`absolute bottom-2 left-0 top-2 w-[2px] rounded-full bg-ink transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`} />
      <span className={`block truncate text-[15px] leading-snug ${active ? 'font-semibold' : ''}`}>{title}</span>
      {(sub || note) && (
        <span className="mt-0.5 flex items-baseline justify-between gap-2 text-[12.5px] text-ink-3">
          <span className="num truncate">{sub}</span>
          {note && <span className="shrink-0">{note}</span>}
        </span>
      )}
    </button>
  )
}

function AddMenu({ onAdd }: { onAdd: (k: ExperienceKind) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)
  return (
    <div ref={ref} className="relative">
      <button className="inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Plus size={13} strokeWidth={1.5} />
        新建经历
      </button>
      {open && (
        <div className="pop absolute bottom-8 left-0 z-20 w-[200px] animate-rise p-1.5">
          {KIND_ORDER.map((k) => (
            <button
              key={k}
              className="block w-full rounded-[10px] px-3 py-2 text-left text-[14px] hover:bg-mist"
              onClick={() => {
                onAdd(k)
                setOpen(false)
              }}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function LibraryIndex({ selectedId, section, eduId }: { selectedId?: string; section?: Section; eduId?: string }) {
  const library = useStore((s) => s.library)
  const upsertExperience = useStore((s) => s.upsertExperience)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const { experiences, events, honors, skills, profile } = library

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const match = (e: Experience) => {
      if (!q) return true
      const evText = events
        .filter((ev) => ev.experienceId === e.id)
        .map((ev) => ev.title + ev.action + ev.signals.join('') + ev.variants.map((v) => v.text).join(''))
        .join('')
      return (e.org + e.role + e.summary + evText).toLowerCase().includes(q)
    }
    return KIND_ORDER.map((kind) => ({
      kind,
      items: byTimeDesc(
        experiences.filter((e) => e.kind === kind && match(e)),
        (e) => e,
      ),
    }))
  }, [experiences, events, query])

  const add = (kind: ExperienceKind) => {
    const exp = newExperience(kind)
    upsertExperience(exp)
    navigate(`/app/library/${exp.id}`)
  }

  const schools = byTimeDesc(profile.education, (e) => e)

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-r border-rule">
      <div className="px-8 pb-5 pt-10">
        <h1 className="text-[30px] font-semibold leading-tight tracking-[0.04em]">事实库</h1>
        <p className="mt-1.5 text-[13px] text-ink-3">
          <span className="num">{experiences.length + profile.education.length}</span> 段经历 · <span className="num">{events.length}</span> 件事
        </p>
        <label className="relative mt-6 block">
          <Search size={14} strokeWidth={1.5} className="absolute left-0 top-1/2 -translate-y-1/2 text-ink-3" />
          <input className="input-line pl-6 text-[14px]" placeholder="搜索机构、事件、能力" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      <nav className="scroll-thin min-h-0 flex-1 overflow-y-auto pb-6 pl-3 pr-5" aria-label="事实库目录">
        {!query && (
          <div className="mb-6">
            <div className="mb-1 flex items-center justify-between pl-5">
              <span className="label">教育背景</span>
            </div>
            {schools.length === 0 ? (
              <IndexItem active={section === 'education'} onClick={() => navigate('/app/library?section=education')} title="添加教育背景" />
            ) : (
              schools.map((e) => (
                <IndexItem
                  key={e.id}
                  active={section === 'education' && (eduId ? eduId === e.id : schools[0].id === e.id)}
                  onClick={() => navigate(`/app/library?section=education&edu=${e.id}`)}
                  title={e.school || '未填写学校'}
                  sub={dateRange(e.start, e.end)}
                  note={e.degree}
                />
              ))
            )}
          </div>
        )}
        {groups.map((g) =>
          g.items.length === 0 ? null : (
            <div key={g.kind} className="mb-6">
              <div className="mb-1 flex items-center justify-between pl-5">
                <span className="label">{KIND_LABEL[g.kind]}</span>
                <button
                  className="grid size-6 place-items-center rounded-full text-ink-3 hover:bg-mist hover:text-ink"
                  onClick={() => add(g.kind)}
                  aria-label={`新建${KIND_LABEL[g.kind]}`}
                  title={`新建${KIND_LABEL[g.kind]}`}
                >
                  <Plus size={14} strokeWidth={1.5} />
                </button>
              </div>
              {g.items.map((exp) => (
                <IndexItem
                  key={exp.id}
                  active={exp.id === selectedId}
                  onClick={() => navigate(`/app/library/${exp.id}`)}
                  title={exp.org || '未命名经历'}
                  sub={dateRange(exp.start, exp.end)}
                  note={`${events.filter((e) => e.experienceId === exp.id).length} 件`}
                />
              ))}
            </div>
          ),
        )}
        {query && groups.every((g) => g.items.length === 0) && <p className="py-2 pl-5 text-[13px] text-ink-4">没有匹配的经历</p>}
        <div className="border-t border-rule pt-4">
          <IndexItem active={section === 'profile'} onClick={() => navigate('/app/library?section=profile')} title="个人信息" />
          <IndexItem active={section === 'honor'} onClick={() => navigate('/app/library?section=honor')} title="荣誉奖项" note={honors.length ? `${honors.length}` : undefined} />
          <IndexItem active={section === 'skill'} onClick={() => navigate('/app/library?section=skill')} title="技能" note={skills.length ? `${skills.length}` : undefined} />
        </div>
      </nav>
      <div className="border-t border-rule px-8 py-4">
        <AddMenu onAdd={add} />
      </div>
    </aside>
  )
}

/* ---------- 右侧阅读区 ---------- */

function ExperienceForm({ exp, onDone }: { exp: Experience; onDone: () => void }) {
  const upsert = useStore((s) => s.upsertExperience)
  const [d, setD] = useState(exp)
  const set = <K extends keyof Experience>(k: K, v: Experience[K]) => setD((x) => ({ ...x, [k]: v }))
  const types = KIND_TYPES[d.kind]
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[1fr_160px] gap-8">
        <Field label={d.kind === 'project' ? '项目名称' : d.kind === 'research' ? '实验室或课题' : '公司或组织'}>
          <input className="input-line text-[24px] font-semibold" value={d.org} onChange={(e) => set('org', e.target.value)} autoFocus={!d.org} />
        </Field>
        <Field label="栏目">
          <select
            className="input-line"
            value={d.kind}
            onChange={(e) => {
              const kind = e.target.value as ExperienceKind
              setD((x) => ({ ...x, kind, employmentType: KIND_TYPES[kind].includes(x.employmentType) ? x.employmentType : KIND_TYPES[kind][0] }))
            }}
          >
            {KIND_ORDER.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-[1fr_160px] gap-8">
        <Field label={d.kind === 'project' ? '你的角色' : '职位'}>
          <input className="input-line" value={d.role} onChange={(e) => set('role', e.target.value)} />
        </Field>
        <Field label="性质">
          <select className="input-line" value={d.employmentType} onChange={(e) => set('employmentType', e.target.value as Experience['employmentType'])} disabled={types.length === 1}>
            {types.map((t) => (
              <option key={t} value={t}>
                {EMPLOYMENT_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-8">
        <Field label="开始" hint="例如 2026.07">
          <input className="input-line num" value={d.start} onChange={(e) => set('start', e.target.value)} />
        </Field>
        <Field label="结束" hint="没结束写“至今”">
          <input className="input-line num" value={d.end} onChange={(e) => set('end', e.target.value)} />
        </Field>
      </div>
      <Field label="一句话说明">
        <AutoTextarea className="input-line" value={d.summary} onChange={(e) => set('summary', e.target.value)} />
      </Field>
      <div className="flex items-center justify-between pt-1">
        <span className="text-[13px] text-ink-3">
          简历上的标题：<span className="text-ink-2">{experienceHeading(d) || '—'}</span>
        </span>
        <div className="flex gap-2">
          <button className="btn btn-quiet btn-sm" onClick={onDone}>
            取消
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              upsert({ ...d, version: d.version + 1 })
              onDone()
            }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

function Suggestion({ exp }: { exp: Experience }) {
  const events = useStore((s) => s.library.events)
  const recategorize = useRecategorize()
  const [dismissed, setDismissed] = useState(false)
  const text = events
    .filter((e) => e.experienceId === exp.id)
    .map((e) => `${e.title} ${e.action}`)
    .join('\n')
  const s = suggestCategory(exp, text)
  if (!s || dismissed) return null
  return (
    <div className="glass mt-6 flex animate-rise items-center gap-3 rounded-[16px] py-2.5 pl-4 pr-2.5 text-[14px]">
      <Lightbulb size={15} strokeWidth={1.5} className="shrink-0 text-ink-2" />
      <span className="min-w-0 flex-1">
        看起来更像<strong className="mx-0.5 font-semibold">{CATEGORY_LABEL[s.category]}</strong>
        <span className="ml-1.5 text-[13px] text-ink-3">{s.reason}</span>
      </span>
      <button className="btn btn-primary btn-sm" onClick={() => recategorize(exp, s.category)}>
        改为{CATEGORY_LABEL[s.category]}
      </button>
      <button className="btn btn-quiet btn-sm" onClick={() => setDismissed(true)}>
        不用
      </button>
    </div>
  )
}

function ExperienceView({ exp }: { exp: Experience }) {
  const allEvents = useStore((s) => s.library.events)
  const upsertEvent = useStore((s) => s.upsertEvent)
  const deleteExperience = useStore((s) => s.deleteExperience)
  const navigate = useNavigate()
  const [editing, setEditing] = useState(!exp.org)
  const [showRaw, setShowRaw] = useState(false)
  const events = allEvents.filter((e) => e.experienceId === exp.id)

  const addEvent = () =>
    upsertEvent({
      id: uid('ev'),
      experienceId: exp.id,
      title: '',
      background: '',
      action: '',
      result: '',
      metrics: [],
      signals: [],
      contribution: '',
      evidence: 'self',
      sourceNote: '',
      variants: [],
      version: 0,
      updatedAt: Date.now(),
    })

  return (
    <article className="mx-auto max-w-[800px] px-14 pb-32 pt-12">
      <header>
        {editing ? (
          <ExperienceForm exp={exp} onDone={() => setEditing(false)} />
        ) : (
          <>
            <div className="flex items-center gap-3">
              <CategoryPill exp={exp} />
              {KIND_TYPES[exp.kind][0] !== exp.employmentType && <span className="label">{EMPLOYMENT_LABEL[exp.employmentType]}</span>}
            </div>
            <h2 className="mt-4 text-[38px] font-semibold leading-[1.2] tracking-[0.03em]">{exp.org || '未命名经历'}</h2>
            <p className="mt-2 text-[16.5px] text-ink-2">
              {roleLine(exp)}
              {roleLine(exp) && <span className="mx-2.5 text-ink-4">·</span>}
              <span className="num">{dateRange(exp.start, exp.end)}</span>
            </p>
            {exp.summary && <p className="mt-3 text-[15px] leading-[1.8] text-ink-2">{exp.summary}</p>}
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
              <TextButton onClick={() => setEditing(true)}>编辑基本信息</TextButton>
              {exp.rawText && <TextButton onClick={() => setShowRaw((v) => !v)}>{showRaw ? '收起原始材料' : '原始材料'}</TextButton>}
              <TextButton
                danger
                onClick={() => {
                  if (confirm(`删除“${exp.org || '这段经历'}”和其中 ${events.length} 件事？已生成的简历不受影响。`)) {
                    deleteExperience(exp.id)
                    navigate('/app/library')
                  }
                }}
              >
                删除经历
              </TextButton>
            </div>
            {showRaw && <blockquote className="mt-4 whitespace-pre-wrap border-l-2 border-rule-2 pl-4 text-[14px] leading-[1.85] text-ink-2">{exp.rawText}</blockquote>}
            <Suggestion key={exp.id + exp.kind} exp={exp} />
          </>
        )}
      </header>

      <div className="mt-14 flex items-baseline justify-between border-b border-ink pb-3">
        <h3 className="text-[15px] tracking-[0.1em]">
          这段经历里的事<sup className="num ml-1 text-[11px] text-ink-3">{events.length}</sup>
        </h3>
        {events.length > 0 && (
          <Link to={`/app/rewrite?exp=${exp.id}`} className="inline-flex items-center gap-1.5 text-[13.5px] text-ink hover:underline">
            <Sparkles size={13} strokeWidth={1.6} />
            重写这段经历
          </Link>
        )}
      </div>

      <div>
        {events.map((ev) => (
          <EventSection key={ev.id} event={ev} />
        ))}
      </div>

      <div className="mt-2 flex items-center gap-6 border-t border-rule pt-8">
        <button className="btn btn-outline btn-sm" onClick={addEvent}>
          <Plus size={14} strokeWidth={1.5} />
          记一件新的事
        </button>
        <button className="link-reveal text-[14px] text-ink-2 hover:text-ink" onClick={() => navigate(`/app/chat?exp=${exp.id}`)}>
          或者和 AI 聊出来
        </button>
      </div>
    </article>
  )
}

function Welcome() {
  const loadDemo = useStore((s) => s.loadDemo)
  return (
    <div className="mx-auto flex max-w-[560px] flex-col items-start px-14 pt-28">
      <h2 className="text-[38px] font-semibold leading-tight tracking-[0.04em]">从一段经历开始</h2>
      <p className="mt-4 text-[16px] leading-[1.9] text-ink-2">实习、科研、课程项目、社团都算。</p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link to="/app/import" className="btn btn-primary">
          导入简历
        </Link>
        <Link to="/app/chat" className="btn btn-outline">
          和 AI 聊一段
        </Link>
      </div>
      <button className="link-reveal mt-6 text-[14px] text-ink-3 hover:text-ink" onClick={loadDemo}>
        先看看示例资料
      </button>
    </div>
  )
}

export function LibraryPage() {
  const { experienceId } = useParams()
  const [params] = useSearchParams()
  const experiences = useStore((s) => s.library.experiences)
  const hasEducation = useStore((s) => s.library.profile.education.length > 0)
  const rewritten = useStore((s) => s.library.events.some((e) => e.variants.some((v) => v.origin === 'ai')))
  const section = (params.get('section') as Section | null) ?? undefined
  const eduId = params.get('edu') ?? undefined

  const ordered = KIND_ORDER.flatMap((k) =>
    byTimeDesc(
      experiences.filter((e) => e.kind === k),
      (e) => e,
    ),
  )
  const selected = section ? undefined : (experiences.find((e) => e.id === experienceId) ?? ordered[0])

  useEffect(() => {
    if (section === 'education' && eduId) window.setTimeout(() => document.getElementById(`edu-${eduId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
  }, [section, eduId])

  const panel = (node: React.ReactNode) => <div className="mx-auto max-w-[800px] px-14 pb-32 pt-12">{node}</div>

  return (
    <div className="flex h-full">
      <LibraryIndex selectedId={selected?.id} section={section} eduId={eduId} />
      <div className="scroll-thin relative min-w-0 flex-1 overflow-y-auto">
        {section === 'profile' && panel(<ProfilePanel />)}
        {section === 'education' && panel(<EducationPanel focusId={eduId} />)}
        {section === 'honor' && panel(<HonorsPanel />)}
        {section === 'skill' && panel(<SkillsPanel />)}
        {!section && (selected ? <ExperienceView key={selected.id} exp={selected} /> : hasEducation ? panel(<EducationPanel />) : <Welcome />)}
        {!section && selected && !rewritten && (
          <div className="pointer-events-none sticky bottom-6 flex justify-center px-6">
            <NextStep className="pointer-events-auto" action="开始重写" to={`/app/rewrite?exp=${experiences.map((e) => e.id).join(',')}`}>
              让 AI 挖掘这些经历的价值
            </NextStep>
          </div>
        )}
      </div>
    </div>
  )
}
