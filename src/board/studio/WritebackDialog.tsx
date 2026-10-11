import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Event, ResumeBullet } from '../../lib/schema'
import { useStore } from '../../store/store'
import { unsupportedNumbers } from '../../lib/facts'
import { uid } from '../../lib/ids'
import { Field } from '../../components/ui'

/**
 * 回写：把简历里改好的一句话存回事实库，作为这件事的一个新表达。
 * 只新增表达，不覆盖事实；出现事实库没有的数字时提醒补上来源。
 */
export function WritebackDialog({
  event,
  bullet,
  onClose,
  onSaved,
}: {
  event: Event
  bullet: ResumeBullet
  onClose: () => void
  onSaved: (variantId: string) => void
}) {
  const addVariant = useStore((s) => s.addVariant)
  const source = event.variants.find((v) => v.id === bullet.variantId)
  const [angle, setAngle] = useState(source ? `${source.angle}·改` : '自定义')
  const extra = unsupportedNumbers(`${bullet.lead} ${bullet.text}`, event)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const save = () => {
    const id = uid('va')
    addVariant(event.id, {
      id,
      angle: angle.trim() || '自定义',
      lead: bullet.lead,
      text: bullet.text,
      origin: 'user',
      createdAt: Date.now(),
    })
    onSaved(id)
  }

  return createPortal(
    <div className="fixed inset-0 z-50 grid animate-fade place-items-center bg-ink/20 p-6 backdrop-blur-[3px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-labelledby="wb-title"
        className="pop w-full max-w-[600px] animate-rise !rounded-[20px] p-9"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="label">存回事实库</p>
        <h2 id="wb-title" className="mt-1.5 text-[24px] font-semibold tracking-[0.03em]">
          存为「{event.title}」的新表达
        </h2>
        <p className="mt-2 text-[14.5px] leading-[1.8] text-ink-2">事实本身不会改动，只是多一种写法，以后其他简历也能用。</p>

        <div className="mt-7 space-y-5 text-[15.5px] leading-[1.85]">
          <div className="border-l-2 border-rule-2 pl-4 text-ink-3">
            <p className="label mb-1">原来 · {source?.angle ?? '无'}</p>
            {source ? (
              <>
                {source.lead && <strong className="font-semibold">{source.lead}：</strong>}
                {source.text}
              </>
            ) : (
              '—'
            )}
          </div>
          <div className="border-l-2 border-ink pl-4">
            <p className="label mb-1">现在</p>
            {bullet.lead && <strong className="font-semibold">{bullet.lead}：</strong>}
            {bullet.text}
          </div>
        </div>

        {extra.length > 0 && (
          <p className="mt-6 rounded-[12px] bg-alert-wash px-4 py-3 text-[14px] leading-relaxed text-alert">
            新的写法里有事实库没有记录的数字：<strong className="num">{extra.join('、')}</strong>。建议先在事实里补上它的来源。
          </p>
        )}

        <Field label="这种写法的角度" className="mt-6 w-56">
          <input className="input-line" value={angle} onChange={(e) => setAngle(e.target.value)} />
        </Field>

        <div className="mt-9 flex justify-end gap-2">
          <button className="btn btn-quiet" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" onClick={save}>
            存为新写法
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
