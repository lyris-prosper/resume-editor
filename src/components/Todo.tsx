import { useState } from 'react'
import { Hash } from 'lucide-react'
import { todos } from '../lib/facts'

/** 文字里的【补充：…】显示成待填写的小框，其他文字照常 */
export function TodoText({ text, className = '' }: { text: string; className?: string }) {
  const parts = text.split(/(【补充：[^】]{1,24}】)/)
  return (
    <span className={className}>
      {parts.map((p, i) => {
        const m = p.match(/^【补充：(.+)】$/)
        return m ? (
          <span key={i} className="todo" title="需要你补上真实的数字">
            {m[1]}
          </span>
        ) : (
          <span key={i}>{p}</span>
        )
      })}
    </span>
  )
}

/**
 * 把占位换成真实数字：填好的数字同时记进这件事的事实，之后检查不会再报“事实里没有”。
 * 没有这个数字时可以删掉占位。
 */
export function FillGaps({ text, onFill }: { text: string; onFill: (text: string, added: string[]) => void }) {
  const gaps = todos(text)
  const [values, setValues] = useState<string[]>(() => gaps.map(() => ''))
  if (!gaps.length) return null

  const apply = (drop?: number) => {
    let i = 0
    const added: string[] = []
    const next = text
      .replace(/【补充：[^】]{1,24}】/g, (whole) => {
        const k = i++
        if (k === drop) return ''
        const v = values[k]?.trim()
        if (!v) return whole
        added.push(`${gaps[k]}：${v}`)
        return v
      })
      .replace(/，，/g, '，')
      .replace(/\s{2,}/g, ' ')
    onFill(next, added)
    setValues((vs) => vs.filter((_, k) => k !== drop && !vs[k]?.trim()))
  }

  return (
    <div className="mt-4 rounded-[14px] bg-alert-wash/70 px-4 py-3">
      <p className="flex items-center gap-1.5 text-[13px] text-alert">
        <Hash size={13} strokeWidth={1.8} />
        还有 {gaps.length} 处数字等你补上，补好的数字会记进事实
      </p>
      <div className="mt-2.5 space-y-2">
        {gaps.map((g, k) => (
          <div key={`${g}-${k}`} className="flex items-center gap-2 text-[13.5px]">
            <span className="w-[8.5em] shrink-0 truncate text-ink-2" title={g}>
              {g}
            </span>
            <input
              className="input-line num min-w-0 flex-1 !py-1"
              placeholder="填真实数字，如 300 份"
              value={values[k] ?? ''}
              onChange={(e) => setValues((vs) => vs.map((x, j) => (j === k ? e.target.value : x)))}
              onKeyDown={(e) => e.key === 'Enter' && apply()}
              aria-label={g}
            />
            <button className="shrink-0 text-[12.5px] text-ink-3 hover:text-ink" onClick={() => apply(k)}>
              没有，删掉
            </button>
          </div>
        ))}
      </div>
      <button className="btn btn-primary btn-sm mt-3" onClick={() => apply()} disabled={!values.some((v) => v.trim())}>
        填入
      </button>
    </div>
  )
}
