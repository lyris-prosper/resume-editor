import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { Decision, Segment } from '../lib/diff'
import { TodoText } from './Todo'

interface Layout {
  callout: { x: number; y: number }
  handles: { x: number; top: number; bottom: number; end: boolean }[]
}

/**
 * 修改标注：没变的字照常显示，删去的划掉变灰，新写的加粗、像被系统选中一样。
 * 指向或选中一处修改时，两端出现选区把手，上方弹出“采纳 / 保留原文”的编辑菜单。
 */
export function DiffView({
  segments,
  decisions,
  onDecide,
  className = '',
}: {
  segments: Segment[]
  decisions: Record<number, Decision>
  onDecide: (id: number, d: Decision | undefined) => void
  className?: string
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<number | null>(null)
  const [layout, setLayout] = useState<Layout | null>(null)
  const hideTimer = useRef(0)

  const show = useCallback((id: number) => {
    window.clearTimeout(hideTimer.current)
    setActive(id)
  }, [])
  const hideSoon = useCallback(() => {
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setActive(null), 220)
  }, [])
  useEffect(() => () => window.clearTimeout(hideTimer.current), [])

  // 计算菜单和把手的位置：按行内文字的实际矩形，跨行时也准确
  useLayoutEffect(() => {
    const box = boxRef.current
    if (active === null || !box) return setLayout(null)
    const el = box.querySelector<HTMLElement>(`[data-hunk="${active}"]`)
    if (!el) return setLayout(null)
    const base = box.getBoundingClientRect()
    const rects = [...el.getClientRects()]
    if (!rects.length) return setLayout(null)
    const first = rects[0]
    const x = Math.min(Math.max(first.left - base.left + first.width / 2, 70), base.width - 70)
    const ins = el.querySelector('.diff-ins')
    const handles: Layout['handles'] = []
    if (ins && decisions[active] === undefined) {
      const r = [...ins.getClientRects()]
      if (r.length) {
        const a = r[0]
        const b = r[r.length - 1]
        handles.push({ x: a.left - base.left, top: a.top - base.top, bottom: a.bottom - base.top, end: false })
        handles.push({ x: b.right - base.left, top: b.top - base.top, bottom: b.bottom - base.top, end: true })
      }
    }
    setLayout({ callout: { x, y: first.top - base.top }, handles })
  }, [active, decisions, segments])

  const ids = segments.flatMap((s) => (s.kind === 'change' ? [s.hunk.id] : []))
  const focusHunk = (id: number | undefined) => {
    if (id === undefined) return
    boxRef.current?.querySelector<HTMLElement>(`[data-hunk="${id}"]`)?.focus()
  }

  const onKey = (e: KeyboardEvent, id: number) => {
    const i = ids.indexOf(id)
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onDecide(id, decisions[id] === 'accept' ? undefined : 'accept')
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      onDecide(id, decisions[id] === 'reject' ? undefined : 'reject')
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      focusHunk(ids[i + 1])
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      focusHunk(ids[i - 1])
    } else if (e.key === 'Escape') (e.target as HTMLElement).blur()
  }

  const current = active === null ? undefined : decisions[active]

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <span>
        {segments.map((s, i) => {
          if (s.kind === 'equal') return <TodoText key={`e${i}`} text={s.text} />
          const { id, del, ins } = s.hunk
          const d = decisions[id]
          const label = d ? (d === 'accept' ? `已采纳：${ins || '删去'}` : `已保留原文：${del || '不加这句'}`) : `修改：${del ? `删去「${del}」` : ''}${ins ? `写成「${ins}」` : ''}。回车采纳，退格保留原文`
          const body =
            d === 'accept' ? (
              ins ? <TodoText className="diff-taken" text={ins} /> : <Gap />
            ) : d === 'reject' ? (
              del ? <TodoText className="diff-kept" text={del} /> : <Gap />
            ) : (
              <>
                {del && (
                  <del className="diff-del">
                    <TodoText text={del} />
                  </del>
                )}
                {ins && (
                  <ins className="diff-ins no-underline">
                    <TodoText text={ins} />
                  </ins>
                )}
              </>
            )
          return (
            <span
              key={`h${id}`}
              data-hunk={id}
              data-active={active === id}
              tabIndex={0}
              role="button"
              aria-label={label}
              className="hunk"
              onMouseEnter={() => show(id)}
              onMouseLeave={hideSoon}
              onFocus={() => show(id)}
              onBlur={hideSoon}
              onClick={() => show(id)}
              onKeyDown={(e) => onKey(e, id)}
            >
              {body}
            </span>
          )
        })}
      </span>

      {layout?.handles.map((h) => (
        <span
          key={h.end ? 'end' : 'start'}
          aria-hidden
          className="pointer-events-none absolute w-[2px] rounded-full bg-handle"
          style={{ left: h.x - 1, top: h.top - 1, height: h.bottom - h.top + 2 }}
        >
          <span className={`absolute left-1/2 size-[9px] -translate-x-1/2 rounded-full bg-handle shadow-[0_0_0_1.5px_#fff] ${h.end ? '-bottom-[7px]' : '-top-[7px]'}`} />
        </span>
      ))}

      {layout && active !== null && (
        <div
          className="absolute z-20 -translate-x-1/2 -translate-y-full pb-2.5"
          style={{ left: layout.callout.x, top: layout.callout.y - 4 }}
          onMouseEnter={() => show(active)}
          onMouseLeave={hideSoon}
        >
          <div key={active} className="callout animate-pop" role="menu" aria-label="这处修改">
            {current === undefined ? (
              <>
                <button role="menuitem" onMouseDown={(e) => e.preventDefault()} onClick={() => onDecide(active, 'accept')}>
                  采纳
                </button>
                <button role="menuitem" onMouseDown={(e) => e.preventDefault()} onClick={() => onDecide(active, 'reject')}>
                  保留原文
                </button>
              </>
            ) : (
              <button role="menuitem" onMouseDown={(e) => e.preventDefault()} onClick={() => onDecide(active, undefined)}>
                {current === 'accept' ? '撤销采纳' : '撤销，重新考虑'}
              </button>
            )}
          </div>
          <span className="absolute bottom-[5px] left-1/2 size-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-[rgb(30_30_32/0.9)]" aria-hidden />
        </div>
      )}
    </div>
  )
}

/** 删去或不加的位置：留一道细缝，仍然可以点开撤销 */
function Gap() {
  return <span className="mx-px inline-block h-[0.9em] w-[3px] translate-y-[0.1em] rounded-full bg-ink-4/60 align-baseline" />
}

/** 图例：解释两种标注 */
export function DiffLegend() {
  return (
    <span className="inline-flex items-center gap-3 text-[12px] text-ink-3">
      <span>
        <span className="diff-ins px-1">新写</span>
      </span>
      <span>
        <span className="diff-del px-1">删去</span>
      </span>
    </span>
  )
}
