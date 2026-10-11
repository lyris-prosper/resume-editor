import { useLayoutEffect, useRef, type ReactNode, type TextareaHTMLAttributes } from 'react'

/** 随内容增高的文本框 */
export function AutoTextarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [props.value])
  return <textarea ref={ref} rows={1} {...props} className={`resize-none leading-[1.75] ${className}`} />
}

/** 字段：小标签 + 内容 */
export function Field({ label, hint, children, className = '' }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 flex items-baseline justify-between gap-3">
        <span className="label">{label}</span>
        {hint && <span className="text-[12px] text-ink-4">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

/** 页面主标题 */
export function PageTitle({ title, meta, actions }: { title: string; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-6">
      <div className="min-w-0">
        <h1 className="text-[30px] font-semibold leading-tight tracking-[0.04em]">{title}</h1>
        {meta && <div className="mt-1.5 text-[13.5px] text-ink-3">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

/** 空状态：说明下一步，而不是渲染情绪 */
export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <div className="text-[22px] font-semibold tracking-[0.04em]">{title}</div>
      {children && <div className="mt-3 max-w-[420px] text-[15px] leading-[1.85] text-ink-2">{children}</div>}
      {action && <div className="mt-8 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  )
}

/** 小号文字按钮：编辑、删除这类次要操作 */
export function TextButton({
  children,
  onClick,
  danger,
  disabled,
  title,
}: {
  children: ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      data-danger={danger || undefined}
      className="inline-flex items-center gap-1 text-[13px] text-ink-3 transition-colors hover:text-ink active:text-ink-2 disabled:text-ink-4"
    >
      {children}
    </button>
  )
}
