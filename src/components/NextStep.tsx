import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

/** 下一步指引：一句话 + 一个动作，浮在毛玻璃上 */
export function NextStep({
  label = '下一步',
  children,
  action,
  to,
  state,
  onClick,
  className = '',
}: {
  label?: string
  children: ReactNode
  action?: string
  to?: string
  state?: unknown
  onClick?: () => void
  className?: string
}) {
  const btn = action ? (
    to ? (
      <Link to={to} state={state} onClick={onClick} className="btn btn-primary btn-sm group shrink-0">
        {action}
        <ArrowRight size={14} strokeWidth={1.6} className="transition-transform group-hover:translate-x-0.5" />
      </Link>
    ) : (
      <button onClick={onClick} className="btn btn-primary btn-sm group shrink-0">
        {action}
        <ArrowRight size={14} strokeWidth={1.6} className="transition-transform group-hover:translate-x-0.5" />
      </button>
    )
  ) : null
  return (
    <div className={`glass inline-flex max-w-full animate-rise items-center gap-4 rounded-full py-1.5 pl-5 pr-1.5 ${className}`} role="status">
      <span className="flex min-w-0 items-center gap-2.5 text-[14px]">
        <span className="relative flex size-2 shrink-0" aria-hidden>
          <span className="absolute inset-0 animate-ping rounded-full bg-ink/30 [animation-duration:2.4s]" />
          <span className="relative size-2 rounded-full bg-ink" />
        </span>
        <span className="shrink-0 text-ink-3">{label}</span>
        <span className="truncate text-ink">{children}</span>
      </span>
      {btn}
    </div>
  )
}
