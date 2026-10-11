import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, ChevronDown, SlidersHorizontal } from 'lucide-react'
import type { Resume, TemplateId } from '../../lib/schema'
import { useDismiss } from '../../lib/useDismiss'
import { contentVolume } from '../../lib/assemble'
import { ACCENTS, TEMPLATE_ACCENT, TEMPLATE_GROUPS, templateMeta } from '../../lib/templates'
import { A4, Paper, type PaperHandlers } from '../../templates/Paper'
import { Schematic } from '../../templates/Schematic'

type Update = (fn: (r: Resume) => void) => void

/** 换版式：没改过强调色时，跟着换成新版式的默认色 */
export function switchTemplate(r: Resume, id: TemplateId) {
  if (r.style.accent === TEMPLATE_ACCENT[r.template]) r.style.accent = TEMPLATE_ACCENT[id]
  r.template = id
}

export function TemplateSwitch({ resume, update }: { resume: Resume; update: Update }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)
  const rich = contentVolume(resume).rich
  const current = templateMeta(resume.template)
  return (
    <div ref={ref} className="relative">
      <button className="btn btn-quiet btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="listbox">
        <Schematic id={resume.template} className="h-6 w-[18px]" />
        {current.name}
        <ChevronDown size={13} strokeWidth={1.5} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="pop absolute right-0 top-10 z-30 w-[420px] animate-rise p-3" role="listbox" aria-label="版式">
          {TEMPLATE_GROUPS.map((g) => (
            <div key={g.id} className="p-2">
              <div className="mb-2 flex items-baseline gap-2">
                <span className="text-[13.5px] font-semibold">{g.label}</span>
                <span className="text-[12px] text-ink-3">{g.note}</span>
                {(g.id === 'rich') === rich && <span className="ml-auto rounded-full bg-ink px-2 py-px text-[11px] text-paper">适合这份</span>}
              </div>
              <div className="grid grid-cols-2 gap-1">
                {g.items.map((t) => {
                  const on = resume.template === t.id
                  return (
                    <button
                      key={t.id}
                      role="option"
                      aria-selected={on}
                      onClick={() => {
                        update((r) => switchTemplate(r, t.id))
                        setOpen(false)
                      }}
                      className={`flex items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition-colors ${on ? 'bg-mist' : 'hover:bg-mist'}`}
                    >
                      <Schematic id={t.id} className="h-9 w-[27px] shrink-0 text-ink-2" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1 text-[14px]">
                          {t.name}
                          {on && <Check size={12} strokeWidth={2.4} />}
                        </span>
                        <span className="block truncate text-[12px] text-ink-3">{t.note}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function StyleMenu({ resume, update }: { resume: Resume; update: Update }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)
  return (
    <div ref={ref} className="relative">
      <button className="btn btn-quiet btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <SlidersHorizontal size={14} strokeWidth={1.5} />
        细节
      </button>
      {open && (
        <div className="pop absolute right-0 top-10 z-30 w-[280px] animate-rise space-y-5 p-6">
          <label className="block">
            <span className="flex justify-between text-[13px]">
              <span className="text-ink-2">字号</span>
              <span className="num text-ink-3">{Math.round(resume.style.fontScale * 100)}%</span>
            </span>
            <input
              type="range"
              min={0.88}
              max={1.1}
              step={0.02}
              value={resume.style.fontScale}
              onChange={(e) => update((r) => void (r.style.fontScale = Number(e.target.value)))}
              className="mt-2 w-full accent-ink"
            />
          </label>
          <label className="block">
            <span className="flex justify-between text-[13px]">
              <span className="text-ink-2">行距</span>
              <span className="num text-ink-3">{resume.style.lineHeight.toFixed(2)}</span>
            </span>
            <input
              type="range"
              min={1.35}
              max={1.8}
              step={0.05}
              value={resume.style.lineHeight}
              onChange={(e) => update((r) => void (r.style.lineHeight = Number(e.target.value)))}
              className="mt-2 w-full accent-ink"
            />
          </label>
          <div>
            <span className="text-[13px] text-ink-2">强调色</span>
            <div className="mt-2.5 flex gap-2.5" role="radiogroup" aria-label="强调色">
              {ACCENTS.map((c) => (
                <button
                  key={c}
                  role="radio"
                  aria-checked={resume.style.accent === c}
                  aria-label={`强调色 ${c}`}
                  onClick={() => update((r) => void (r.style.accent = c))}
                  className={`size-6 rounded-full ring-offset-2 transition-shadow ${resume.style.accent === c ? 'ring-1 ring-ink' : 'hover:ring-1 hover:ring-rule-2'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** 纸张预览：按容器宽度缩放，超过一页时画出分页线 */
export function Preview({ resume, handlers }: { resume: Resume; handlers: PaperHandlers }) {
  const deskRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.8)
  const [height, setHeight] = useState(A4.height)

  useLayoutEffect(() => {
    const desk = deskRef.current
    if (!desk) return
    const ro = new ResizeObserver(([entry]) => setScale(Math.min(1, (entry.contentRect.width - 140) / A4.width)))
    ro.observe(desk)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const el = paperRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeight(el.scrollHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const pages = Math.max(1, Math.ceil(height / A4.height - 0.02))

  return (
    <div ref={deskRef} className="relative min-h-full px-[70px] pb-20 pt-8">
      <div className="mx-auto" style={{ width: A4.width * scale }}>
        <div className="mb-3 flex items-baseline justify-between text-[12.5px] text-ink-3">
          <span>A4 · {templateMeta(resume.template).name}</span>
          {pages > 1 ? (
            <span className="text-ink-2">
              共 <span className="num">{pages}</span> 页 · 可以隐藏几条、换紧凑版式或调小字号
            </span>
          ) : (
            <span>一页</span>
          )}
        </div>
        <div className="relative" style={{ height: Math.max(height, A4.height) * scale }}>
          <div className="paper-shadow absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${scale})` }}>
            <Paper ref={paperRef} resume={resume} handlers={handlers} />
          </div>
          {Array.from({ length: pages - 1 }, (_, i) => (
            <div key={i} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-3" style={{ top: A4.height * (i + 1) * scale }}>
              <span className="num absolute -right-[60px] -top-[9px] text-[11.5px] text-ink-3">第 {i + 2} 页</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
