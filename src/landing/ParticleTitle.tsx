import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { ParticleField, type Composition } from './particles'

export interface ParticleTitleHandle {
  show: (comp: Composition) => void
  next: () => void
}

/**
 * 首屏中央的文字粒子。画布本身对读屏软件隐藏，
 * 当前名称通过 onFormed 交给页面上的文字说明。
 */
export const ParticleTitle = forwardRef<
  ParticleTitleHandle,
  {
    sequence: Composition[]
    onFormed?: (comp: Composition) => void
    onScatter?: () => void
    className?: string
  }
>(function ParticleTitle({ sequence, onFormed, onScatter, className = '' }, ref) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fieldRef = useRef<ParticleField | null>(null)
  const handlers = useRef({ onFormed, onScatter })
  handlers.current = { onFormed, onScatter }

  useImperativeHandle(ref, () => ({
    show: (comp) => fieldRef.current?.show(comp),
    next: () => fieldRef.current?.next(),
  }))

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const field = new ParticleField(canvas, {
      reducedMotion,
      onFormed: (c) => handlers.current.onFormed?.(c),
      onScatter: () => handlers.current.onScatter?.(),
    })
    fieldRef.current = field
    field.setSequence(sequence)
    if (import.meta.env.DEV) (window as unknown as { __particles?: ParticleField }).__particles = field

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      field.resize(width, height)
    })
    ro.observe(wrap)
    const rect = wrap.getBoundingClientRect()
    field.resize(rect.width, rect.height)

    const io = new IntersectionObserver(([entry]) => field.setVisible(entry.isIntersecting))
    io.observe(wrap)
    const onVisibility = () => field.setVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVisibility)

    field.start()
    return () => {
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      field.destroy()
      fieldRef.current = null
    }
    // 序列只在挂载时设置一次
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <canvas ref={canvasRef} className="absolute inset-0 block touch-pan-y select-none" aria-hidden />
    </div>
  )
})
