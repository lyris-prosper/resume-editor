import { useCallback, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Plus, Sparkles, Trash2 } from 'lucide-react'
import { EXPERIENCE_SECTIONS, KIND_LABEL, KIND_ORDER, type Event, type ExperienceKind, type Resume, type ResumeBullet, type ResumeItem, type ResumeSection } from '../../lib/schema'
import type { JobFocus } from '../../lib/ai/types'
import { jobKeywords } from '../../lib/ai/rewrite'
import { useStore } from '../../store/store'
import { move, todos, unsupportedNumbers } from '../../lib/facts'
import { dateRange, roleLine } from '../../lib/format'
import { eventLine } from '../../lib/assemble'
import { templateMeta } from '../../lib/templates'
import { uid } from '../../lib/ids'
import { useDismiss } from '../../lib/useDismiss'
import { AutoTextarea } from '../../components/ui'
import { RewriteCard } from '../RewriteCard'
import { WritebackDialog } from './WritebackDialog'

type Update = (fn: (r: Resume) => void) => void

function Icon({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="grid size-7 place-items-center rounded-full text-ink-3 transition-colors hover:bg-mist hover:text-ink disabled:opacity-30"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

/** 悬停才出现的一组操作：上移、下移、隐藏、移除 */
function Controls({
  index,
  count,
  hidden,
  onMove,
  onToggle,
  onRemove,
  className = '',
}: {
  index: number
  count: number
  hidden: boolean
  onMove: (dir: -1 | 1) => void
  onToggle: () => void
  onRemove?: () => void
  className?: string
}) {
  return (
    <div className={`flex items-center opacity-0 transition-opacity focus-within:opacity-100 ${className}`}>
      <Icon label="上移" disabled={index === 0} onClick={() => onMove(-1)}>
        <ArrowUp size={14} strokeWidth={1.5} />
      </Icon>
      <Icon label="下移" disabled={index === count - 1} onClick={() => onMove(1)}>
        <ArrowDown size={14} strokeWidth={1.5} />
      </Icon>
      <Icon label={hidden ? '在简历中显示' : '在简历中隐藏'} onClick={onToggle}>
        {hidden ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
      </Icon>
      {onRemove && (
        <Icon label="从这份简历移除" onClick={onRemove}>
          <Trash2 size={14} strokeWidth={1.5} />
        </Icon>
      )}
    </div>
  )
}

function findItem(r: Resume, sectionId: string, itemId: string) {
  return r.sections.find((s) => s.id === sectionId)?.items.find((i) => i.id === itemId)
}

function BulletEditor({
  bullet,
  index,
  count,
  section,
  item,
  update,
  active,
  onFocus,
  focus,
}: {
  bullet: ResumeBullet
  index: number
  count: number
  section: ResumeSection
  item: ResumeItem
  update: Update
  active: boolean
  onFocus: () => void
  focus?: JobFocus
}) {
  const event = useStore((s) => s.library.events.find((e) => e.id === bullet.eventId))
  const addMetrics = useStore((s) => s.addMetrics)
  const [writeback, setWriteback] = useState(false)
  const [rewriting, setRewriting] = useState(false)
  const source = event?.variants.find((v) => v.id === bullet.variantId)
  const edited = source ? source.text !== bullet.text || source.lead !== bullet.lead : false
  const extra = event ? unsupportedNumbers(`${bullet.lead} ${bullet.text}`, event) : []

  const withItem = (fn: (it: ResumeItem) => void) =>
    update((r) => {
      const it = findItem(r, section.id, item.id)
      if (it) fn(it)
    })
  const patch = (fn: (b: ResumeBullet) => void) =>
    withItem((it) => {
      const b = it.bullets.find((x) => x.id === bullet.id)
      if (b) fn(b)
    })

  return (
    <div
      id={`ed-${bullet.id}`}
      className={`group/b relative border-l py-1.5 pl-4 transition-colors ${active ? 'border-l-2 border-ink' : 'border-rule-2 hover:border-ink-3'} ${bullet.hidden ? 'opacity-45' : ''}`}
      onFocusCapture={onFocus}
    >
      <div className="flex items-start gap-2">
        <input
          className="inline-edit min-w-0 flex-1 text-[14.5px] font-semibold placeholder:font-normal"
          placeholder="概括短语（可以留空）"
          value={bullet.lead}
          onChange={(e) => patch((b) => void (b.lead = e.target.value))}
          aria-label="概括短语"
        />
        <Controls
          className="-mt-1 group-hover/b:opacity-100"
          index={index}
          count={count}
          hidden={bullet.hidden}
          onMove={(dir) => withItem((it) => move(it.bullets, index, dir))}
          onToggle={() => patch((b) => void (b.hidden = !b.hidden))}
          onRemove={() => withItem((it) => void (it.bullets = it.bullets.filter((b) => b.id !== bullet.id)))}
        />
      </div>
      <AutoTextarea className="inline-edit mt-0.5 w-full text-[14.5px] text-ink-2" value={bullet.text} onChange={(e) => patch((b) => void (b.text = e.target.value))} aria-label="正文" />

      {rewriting ? (
        <div className="mt-3">
          <RewriteCard
            compact
            autoRun
            lead={bullet.lead}
            text={bullet.text}
            facts={event}
            job={focus}
            onClose={() => setRewriting(false)}
            onFacts={(m) => event && addMetrics(event.id, m)}
            onApply={(lead, text) =>
              patch((b) => {
                b.lead = lead
                b.text = text
              })
            }
          />
        </div>
      ) : (
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-3">
          {EXPERIENCE_SECTIONS.includes(section.kind) && (
            <button className="inline-flex items-center gap-1 text-ink-2 hover:text-ink" onClick={() => setRewriting(true)}>
              <Sparkles size={12} strokeWidth={1.6} />
              {focus ? '按岗位重写' : 'AI 重写'}
            </button>
          )}
          {event && (
            <span>
              来自<span className="ml-1 text-ink-2">{event.title}</span>
            </span>
          )}
          {event && event.variants.length > 1 && (
            <select
              className="cursor-pointer bg-transparent text-ink-2 outline-none hover:text-ink"
              value={event.variants.some((v) => v.id === bullet.variantId) ? bullet.variantId : ''}
              onChange={(e) => {
                const v = event.variants.find((x) => x.id === e.target.value)
                if (v)
                  patch((b) => {
                    b.variantId = v.id
                    b.lead = v.lead
                    b.text = v.text
                  })
              }}
              aria-label="切换写法"
            >
              {!event.variants.some((v) => v.id === bullet.variantId) && <option value="">自定义</option>}
              {event.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.angle}
                </option>
              ))}
            </select>
          )}
          {edited && source && (
            <>
              <button
                className="hover:text-ink"
                onClick={() =>
                  patch((b) => {
                    b.lead = source.lead
                    b.text = source.text
                  })
                }
              >
                还原
              </button>
              <button className="link text-ink" onClick={() => setWriteback(true)}>
                存回事实库
              </button>
            </>
          )}
          {extra.length > 0 && (
            <span className="ml-auto text-alert" title="这些数字在事实记录里找不到">
              事实里没有 <span className="num font-semibold">{extra.join('、')}</span>
            </span>
          )}
          {todos(bullet.text).length > 0 && (
            <span className="ml-auto text-alert" title="把【补充：…】换成真实数字，或者删掉">
              还有 {todos(bullet.text).length} 处【补充】没填
            </span>
          )}
        </div>
      )}
      {writeback && event && (
        <WritebackDialog
          event={event}
          bullet={bullet}
          onClose={() => setWriteback(false)}
          onSaved={(variantId) => {
            patch((b) => void (b.variantId = variantId))
            setWriteback(false)
          }}
        />
      )}
    </div>
  )
}

function Menu({ label, children, up }: { label: string; children: (close: () => void) => React.ReactNode; up?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)
  return (
    <div ref={ref} className="relative">
      <button className="inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Plus size={13} strokeWidth={1.5} />
        {label}
      </button>
      {open && <div className={`pop absolute left-0 z-20 w-[320px] animate-rise p-1.5 ${up ? 'bottom-7' : 'top-7'}`}>{children(close)}</div>}
    </div>
  )
}

function MenuItem({ title, note, onClick }: { title: string; note?: string; onClick: () => void }) {
  return (
    <button className="block w-full rounded-[10px] px-3 py-2 text-left hover:bg-mist" onClick={onClick}>
      <span className="block text-[14px]">{title}</span>
      {note && <span className="block truncate text-[12.5px] text-ink-3">{note}</span>}
    </button>
  )
}

const toBullet = (ev: Event): ResumeBullet => {
  const line = eventLine(ev)
  return { id: uid('rb'), eventId: ev.id, variantId: line.variantId, lead: line.lead, text: line.text, hidden: false }
}

function AddEvent({ item, section, update }: { item: ResumeItem; section: ResumeSection; update: Update }) {
  const events = useStore((s) => s.library.events)
  const push = (b: ResumeBullet) => update((r) => findItem(r, section.id, item.id)?.bullets.push(b))
  if (!item.experienceId) {
    return (
      <button className="inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink" onClick={() => push({ id: uid('rb'), lead: '', text: '', hidden: false })}>
        <Plus size={13} strokeWidth={1.5} />
        添加一行
      </button>
    )
  }
  const used = new Set(item.bullets.map((b) => b.eventId))
  const options = events.filter((e) => e.experienceId === item.experienceId && !used.has(e.id))
  return (
    <Menu label="从这段经历里再选一件事">
      {(close) =>
        options.length === 0 ? (
          <p className="px-3 py-2 text-[13px] text-ink-3">已经全部选上了。</p>
        ) : (
          options.map((ev) => (
            <MenuItem
              key={ev.id}
              title={ev.title}
              note={eventLine(ev).text}
              onClick={() => {
                push(toBullet(ev))
                close()
              }}
            />
          ))
        )
      }
    </Menu>
  )
}

function AddExperience({ section, update }: { section: ResumeSection; update: Update }) {
  const experiences = useStore((s) => s.library.experiences)
  const events = useStore((s) => s.library.events)
  const kind = (EXPERIENCE_SECTIONS.includes(section.kind) ? section.kind : 'work') as ExperienceKind
  const used = new Set(section.items.map((i) => i.experienceId))
  // 旧简历的“工作经历”里可能放着实习，允许从所有经历里挑，同栏目的排前面
  const options = [...experiences.filter((e) => e.kind === kind), ...experiences.filter((e) => e.kind !== kind)].filter((e) => !used.has(e.id))
  return (
    <Menu label="从事实库添加经历">
      {(close) =>
        options.length === 0 ? (
          <p className="px-3 py-2 text-[13px] text-ink-3">事实库里的经历都已经在这份简历里了。</p>
        ) : (
          options.map((exp) => {
            const evs = events.filter((e) => e.experienceId === exp.id)
            return (
              <MenuItem
                key={exp.id}
                title={exp.org}
                note={`${KIND_LABEL[exp.kind]} · ${evs.length} 件事`}
                onClick={() => {
                  update((r) =>
                    r.sections
                      .find((s) => s.id === section.id)
                      ?.items.push({
                        id: uid('ri'),
                        experienceId: exp.id,
                        heading: exp.org,
                        subheading: roleLine(exp),
                        date: dateRange(exp.start, exp.end),
                        hidden: false,
                        bullets: evs.map(toBullet),
                      }),
                  )
                  close()
                }}
              />
            )
          })
        )
      }
    </Menu>
  )
}

/** 简历里还没有的经历栏目，可以加进来 */
function AddSection({ resume, update }: { resume: Resume; update: Update }) {
  const missing = KIND_ORDER.filter((k) => !resume.sections.some((s) => s.kind === k))
  if (!missing.length) return null
  return (
    <Menu label="添加栏目" up>
      {(close) =>
        missing.map((k) => (
          <MenuItem
            key={k}
            title={KIND_LABEL[k]}
            onClick={() => {
              update((r) => {
                const at = r.sections.findIndex((s) => s.kind === 'honor' || s.kind === 'skill')
                const sec: ResumeSection = { id: uid('rs'), kind: k, title: KIND_LABEL[k], hidden: false, items: [] }
                if (at < 0) r.sections.push(sec)
                else r.sections.splice(at, 0, sec)
              })
              close()
            }}
          />
        ))
      }
    </Menu>
  )
}

function PhotoField({ resume, update }: { resume: Resume; update: Update }) {
  const ref = useRef<HTMLInputElement>(null)
  const shows = templateMeta(resume.template).photo
  const pick = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      // 缩到 360px 宽，避免照片把存储撑大
      const img = new Image()
      img.onload = () => {
        const w = Math.min(360, img.width)
        const c = document.createElement('canvas')
        c.width = w
        c.height = Math.round((img.height / img.width) * w)
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
        update((r) => void (r.header.photo = c.toDataURL('image/jpeg', 0.86)))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }
  return (
    <div className="mt-3 flex items-center gap-3 text-[13px] text-ink-3">
      {resume.header.photo ? (
        <>
          <img src={resume.header.photo} alt="" className="h-12 w-10 rounded-[3px] object-cover shadow-[0_0_0_1px_rgb(17_17_17/0.08)]" />
          <button className="hover:text-ink" onClick={() => ref.current?.click()}>
            换一张
          </button>
          <button className="hover:text-ink" onClick={() => update((r) => void delete r.header.photo)}>
            移除
          </button>
        </>
      ) : (
        <button className="inline-flex items-center gap-1.5 hover:text-ink" onClick={() => ref.current?.click()}>
          <ImagePlus size={14} strokeWidth={1.5} />
          添加证件照
        </button>
      )}
      <span className="text-ink-4">{shows ? '当前版式会显示' : '“衬线雅致”“双栏名片”版式显示'}</span>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) pick(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

export function EditorPanel({ resume, update, activeId, setActiveId }: { resume: Resume; update: Update; activeId?: string; setActiveId: (id: string) => void }) {
  const job = useStore((s) => s.jobs.find((j) => j.id === resume.jobId))
  const focus: JobFocus | undefined = useMemo(
    () => (job ? { title: job.title, company: job.company, keywords: jobKeywords(job.raw), requirements: job.requirements.map((r) => r.text) } : undefined),
    [job],
  )
  return (
    <div className="px-8 pb-28 pt-8">
      <section>
        <p className="label mb-2">抬头</p>
        <input
          className="inline-edit w-full text-[22px] font-semibold tracking-[0.04em]"
          value={resume.header.name}
          onChange={(e) => update((r) => void (r.header.name = e.target.value))}
          aria-label="姓名"
        />
        <input
          className="inline-edit mt-1 w-full text-[14.5px]"
          placeholder="求职方向（可以留空）"
          value={resume.header.headline}
          onChange={(e) => update((r) => void (r.header.headline = e.target.value))}
          aria-label="求职方向"
        />
        <AutoTextarea
          className="inline-edit num mt-1 w-full text-[14px] text-ink-2"
          value={resume.header.contacts.join('\n')}
          onChange={(e) => update((r) => void (r.header.contacts = e.target.value.split('\n')))}
          aria-label="联系方式，一行一个"
        />
        <AutoTextarea
          className="inline-edit mt-1 w-full text-[14px] text-ink-2"
          placeholder="个人概述（可以留空）"
          value={resume.header.summary}
          onChange={(e) => update((r) => void (r.header.summary = e.target.value))}
          aria-label="个人概述"
        />
        <PhotoField resume={resume} update={update} />
      </section>

      {resume.sections.map((section, si) => (
        <section key={section.id} className={`mt-10 ${section.hidden ? 'opacity-45' : ''}`}>
          <div className="group/s flex items-center gap-2 border-b border-ink pb-2">
            <input
              className="inline-edit min-w-0 flex-1 text-[17px] font-semibold tracking-[0.06em]"
              value={section.title}
              onChange={(e) => update((r) => void (r.sections[si].title = e.target.value))}
              aria-label="章节标题"
            />
            <Controls
              className="group-hover/s:opacity-100"
              index={si}
              count={resume.sections.length}
              hidden={section.hidden}
              onMove={(dir) => update((r) => move(r.sections, si, dir))}
              onToggle={() => update((r) => void (r.sections[si].hidden = !section.hidden))}
              onRemove={section.items.length === 0 ? () => update((r) => void r.sections.splice(si, 1)) : undefined}
            />
          </div>

          <div className="mt-4 space-y-6">
            {section.items.map((item, ii) => (
              <div key={item.id} id={`ed-${item.id}`} className={item.hidden ? 'opacity-45' : ''} onFocusCapture={() => setActiveId(item.id)}>
                <div className="group/i relative">
                  <div className="flex items-start gap-2">
                    <input
                      className={`inline-edit min-w-0 flex-1 text-[15.5px] font-semibold ${activeId === item.id ? 'shadow-[0_1.5px_0_var(--color-ink)]' : ''}`}
                      value={item.heading}
                      onChange={(e) => update((r) => void (r.sections[si].items[ii].heading = e.target.value))}
                      aria-label="条目标题"
                    />
                    <Controls
                      className="-mt-0.5 group-hover/i:opacity-100"
                      index={ii}
                      count={section.items.length}
                      hidden={item.hidden}
                      onMove={(dir) => update((r) => move(r.sections[si].items, ii, dir))}
                      onToggle={() => update((r) => void (r.sections[si].items[ii].hidden = !item.hidden))}
                      onRemove={() => update((r) => void (r.sections[si].items = r.sections[si].items.filter((x) => x.id !== item.id)))}
                    />
                  </div>
                  <div className="mt-0.5 flex items-baseline gap-3">
                    <input
                      className="inline-edit min-w-0 flex-1 text-[13.5px] text-ink-2"
                      placeholder={section.kind === 'education' ? '专业，学历' : section.kind === 'skill' ? '技能，用顿号分隔' : '职位或角色'}
                      value={item.subheading}
                      onChange={(e) => update((r) => void (r.sections[si].items[ii].subheading = e.target.value))}
                      aria-label="副标题"
                    />
                    {section.kind !== 'skill' && (
                      <input
                        className="inline-edit num ml-auto w-[130px] shrink-0 text-right text-[13px] text-ink-3"
                        value={item.date}
                        placeholder="时间"
                        onChange={(e) => update((r) => void (r.sections[si].items[ii].date = e.target.value))}
                        aria-label="时间"
                      />
                    )}
                  </div>
                </div>

                {item.bullets.length > 0 && (
                  <div className="mt-3 space-y-3">
                    {item.bullets.map((b, bi) => (
                      <BulletEditor
                        key={b.id}
                        bullet={b}
                        index={bi}
                        count={item.bullets.length}
                        section={section}
                        item={item}
                        update={update}
                        active={activeId === b.id}
                        onFocus={() => setActiveId(b.id)}
                        focus={focus}
                      />
                    ))}
                  </div>
                )}
                {(EXPERIENCE_SECTIONS.includes(section.kind) || section.kind === 'education') && (
                  <div className="mt-2.5 pl-4">
                    <AddEvent item={item} section={section} update={update} />
                  </div>
                )}
              </div>
            ))}
            {EXPERIENCE_SECTIONS.includes(section.kind) && <AddExperience section={section} update={update} />}
          </div>
        </section>
      ))}
      <div className="mt-10 border-t border-rule pt-5">
        <AddSection resume={resume} update={update} />
      </div>
    </div>
  )
}
