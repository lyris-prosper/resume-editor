import { useEffect } from 'react'
import { X } from 'lucide-react'
import { refreshStatus, useAi } from '../lib/ai'

/** AI 状态：顶栏的小标记 */
export function AiBadge() {
  const status = useAi((s) => s.status)
  useEffect(() => {
    void refreshStatus()
    // 切回页面时重新看一眼：用户可能刚在 .env.local 里填了密钥
    const onFocus = () => void refreshStatus(true)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])
  if (!status) return null
  return (
    <span
      className="hidden h-7 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] text-ink-3 shadow-[inset_0_0_0_1px_var(--color-rule-2)] lg:inline-flex"
      title={status.configured ? `AI 由 DeepSeek 提供（${status.model}）` : '还没有配置 DeepSeek 密钥：在项目根目录的 .env.local 里填写 DEEPSEEK_API_KEY'}
    >
      <span className={`size-1.5 rounded-full ${status.configured ? 'bg-ink' : 'border border-ink-4'}`} aria-hidden />
      {status.configured ? 'DeepSeek' : '本地规则'}
    </span>
  )
}

/** DeepSeek 调用失败、改用本地规则时，在页面底部说一声 */
export function AiNotice() {
  const notice = useAi((s) => s.notice)
  const setNotice = useAi((s) => s.setNotice)
  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(null), 9000)
    return () => window.clearTimeout(t)
  }, [notice, setNotice])
  if (!notice) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-6">
      <div role="status" className="glass pointer-events-auto flex max-w-[640px] animate-rise items-center gap-3 rounded-full py-2 pl-5 pr-2 text-[13.5px]">
        <span className="size-1.5 shrink-0 rounded-full bg-alert" aria-hidden />
        <span className="min-w-0 text-ink-2">{notice}</span>
        <button className="grid size-7 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-mist hover:text-ink" onClick={() => setNotice(null)} aria-label="关闭提示">
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
