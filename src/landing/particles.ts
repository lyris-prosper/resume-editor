/**
 * 文字粒子场：同一组粒子在不同文字之间聚合、散开、重组。
 * 粒子数量固定，象征“同一份经历”；先组成“你的无数种可能”，再依次重组成不同的职位。
 *
 * 交互：指针划过时，附近的粒子被带着走，拉成细长的流线，之后再流回字形；
 * 点击会从点击处炸开，并重组成下一个名称。
 */

export interface Composition {
  lines: { text: string; scale?: number }[]
  caption: string
  /** 窄屏时的分行，例如手机上把长名称拆成两行，保证颗粒字足够大 */
  narrow?: { text: string; scale?: number }[]
}

type Phase = 'idle' | 'forming' | 'holding' | 'scattering'

interface Options {
  /** 每次字形聚合完成（可以清晰阅读）时调用 */
  onFormed?: (comp: Composition) => void
  /** 开始散开时调用 */
  onScatter?: () => void
  reducedMotion?: boolean
}

const FAMILY = '"Source Serif 4 Variable", "Noto Serif SC", "Songti SC", serif'
const WEIGHT = 600
const STEP_MS = 1000 / 60

const FORM_RAMP = 1100 // 弹簧从 0 增强到满值的时间
const HOLD_MS = 2700 // 可读的停留时间
const SCATTER_MS = 620
const MAX_FORM_SPEED2 = 7.5 * 7.5

export class ParticleField {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private opts: Options
  private w = 0
  private h = 0
  private dpr = 1
  private n = 0

  private x = new Float32Array(0)
  private y = new Float32Array(0)
  private vx = new Float32Array(0)
  private vy = new Float32Array(0)
  private tx = new Float32Array(0)
  private ty = new Float32Array(0)
  private kMul = new Float32Array(0)
  private free = new Float32Array(0)
  private size = new Float32Array(0)
  private buckets: { color: string; idx: Uint32Array }[] = []

  private sequence: Composition[] = []
  private index = -1
  private current: Composition | null = null
  private pendingTargets: Float32Array | null = null
  private phase: Phase = 'idle'
  private phaseStart = 0
  private holdMs = HOLD_MS
  /** 颗粒粗细，随字号缩放 */
  private grain = 1
  private autoplay = true
  private cache = new Map<string, Float32Array>()
  private requestId = 0

  private pointer = { x: -9999, y: -9999, vx: 0, vy: 0, lastMove: 0, downX: 0, downY: 0, downAt: 0 }

  private raf = 0
  private running = false
  private visible = true
  private lastTime = 0
  private acc = 0
  private clock = 0

  constructor(canvas: HTMLCanvasElement, opts: Options = {}) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.opts = opts
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('pointerleave', this.onPointerLeave)
  }

  /* ---------- 尺寸与粒子 ---------- */

  resize(width: number, height: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const changed = Math.abs(width - this.w) > 1 || Math.abs(height - this.h) > 1 || dpr !== this.dpr
    if (!changed) return
    const prevW = this.w
    const prevH = this.h
    this.w = width
    this.h = height
    this.dpr = dpr
    this.canvas.width = Math.round(width * dpr)
    this.canvas.height = Math.round(height * dpr)
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`
    this.cache.clear()

    const n = Math.round(Math.min(7200, Math.max(2800, (width * height) / 64)))
    if (n !== this.n) this.allocate(n, prevW, prevH)
    if (this.current) this.retarget(this.current, false)
    if (this.opts.reducedMotion) this.draw()
  }

  private allocate(n: number, prevW: number, prevH: number) {
    const old = { x: this.x, y: this.y, n: this.n }
    this.n = n
    this.x = new Float32Array(n)
    this.y = new Float32Array(n)
    this.vx = new Float32Array(n)
    this.vy = new Float32Array(n)
    this.tx = new Float32Array(n)
    this.ty = new Float32Array(n)
    this.kMul = new Float32Array(n)
    this.free = new Float32Array(n)
    this.size = new Float32Array(n)
    const sx = prevW ? this.w / prevW : 1
    const sy = prevH ? this.h / prevH : 1
    for (let i = 0; i < n; i++) {
      if (i < old.n) {
        this.x[i] = old.x[i] * sx
        this.y[i] = old.y[i] * sy
      } else {
        // 初始是一团松散的云，开场时向中间聚拢成字
        const a = Math.random() * Math.PI * 2
        const r = Math.sqrt(Math.random()) * Math.max(this.w, this.h) * 0.62
        this.x[i] = this.w / 2 + Math.cos(a) * r
        this.y[i] = this.h / 2 + Math.sin(a) * r * 0.62
      }
      this.tx[i] = this.x[i]
      this.ty[i] = this.y[i]
      this.kMul[i] = 0.55 + Math.random() * 0.9
      this.size[i] = 0.9 + Math.pow(Math.random(), 1.8) * 1.25
    }
    // 颜色分桶：只用墨色的三档深浅，像同一支笔写出的浓淡
    const groups: number[][] = [[], [], []]
    for (let i = 0; i < n; i++) {
      const r = Math.random()
      groups[r < 0.3 ? 0 : r < 0.68 ? 1 : 2].push(i)
    }
    this.buckets = [
      { color: 'rgba(17,17,17,0.38)', idx: Uint32Array.from(groups[0]) },
      { color: 'rgba(17,17,17,0.66)', idx: Uint32Array.from(groups[1]) },
      { color: 'rgba(17,17,17,0.94)', idx: Uint32Array.from(groups[2]) },
    ]
  }

  /* ---------- 文字采样 ---------- */

  private async sample(comp: Composition): Promise<Float32Array> {
    const lines = comp.narrow && this.w < 560 ? comp.narrow : comp.lines
    const key = `${lines.map((l) => `${l.text}@${l.scale ?? 1}`).join('|')}#${Math.round(this.w)}x${Math.round(this.h)}`
    const hit = this.cache.get(key)
    if (hit) return hit

    const text = lines.map((l) => l.text).join('')
    try {
      await document.fonts.load(`${WEIGHT} 100px ${FAMILY}`, text)
    } catch {
      /* 字体加载失败时用系统衬线 */
    }

    const W = Math.max(1, Math.round(this.w))
    const H = Math.max(1, Math.round(this.h))
    const off = document.createElement('canvas')
    off.width = W
    off.height = H
    const c = off.getContext('2d', { willReadFrequently: true })!
    c.font = `${WEIGHT} 100px ${FAMILY}`
    const lineGap = 1.22
    const widths = lines.map((l) => c.measureText(l.text).width * (l.scale ?? 1))
    const units = lines.reduce((s, l) => s + (l.scale ?? 1) * lineGap, 0)
    const size = Math.min(((W * 0.86) / Math.max(...widths)) * 100, (H * 0.8) / units, H * 0.46, 200)

    c.fillStyle = '#000'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    let cy = H / 2 - (units * size) / 2
    for (const line of lines) {
      const fs = size * (line.scale ?? 1)
      c.font = `${WEIGHT} ${fs}px ${FAMILY}`
      const lh = fs * lineGap
      c.fillText(line.text, W / 2, cy + lh / 2 + fs * 0.04)
      cy += lh
    }

    this.grain = Math.min(1, Math.max(0.72, size / 170))
    const data = c.getImageData(0, 0, W, H).data
    const step = size > 120 ? 2 : 1
    const pts: number[] = []
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        if (data[(y * W + x) * 4 + 3] > 150) pts.push(x, y)
      }
    }
    const m = pts.length / 2
    const out = new Float32Array(this.n * 2)
    if (m === 0) {
      for (let i = 0; i < this.n; i++) {
        out[i * 2] = W / 2
        out[i * 2 + 1] = H / 2
      }
    } else {
      // 洗牌后取前 n 个；点不够时重复使用并加抖动
      const order = new Uint32Array(m)
      for (let i = 0; i < m; i++) order[i] = i
      for (let i = m - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0
        const t = order[i]
        order[i] = order[j]
        order[j] = t
      }
      const jitter = step * 0.9
      for (let i = 0; i < this.n; i++) {
        const j = i < m ? order[i] : order[(Math.random() * m) | 0]
        out[i * 2] = pts[j * 2] + (Math.random() - 0.5) * jitter
        out[i * 2 + 1] = pts[j * 2 + 1] + (Math.random() - 0.5) * jitter
      }
    }
    this.cache.set(key, out)
    return out
  }

  /**
   * 换成新的文字：先立刻散开（点击要有即时反馈），同时异步采样新字形；
   * 散开时间到、且新字形已就绪后才开始聚合。
   */
  private retarget(comp: Composition, scatterFirst: boolean, origin?: { x: number; y: number }) {
    const id = ++this.requestId
    this.awaiting = true
    if (scatterFirst && !this.opts.reducedMotion) this.scatter(origin)
    void this.sample(comp).then((targets) => {
      if (id !== this.requestId) return
      this.awaiting = false
      this.current = comp
      if (this.opts.reducedMotion) {
        for (let i = 0; i < this.n; i++) {
          this.x[i] = this.tx[i] = targets[i * 2]
          this.y[i] = this.ty[i] = targets[i * 2 + 1]
        }
        this.draw()
        this.opts.onFormed?.(comp)
        this.setPhase('holding')
        return
      }
      if (this.phase === 'scattering') this.pendingTargets = targets
      else this.applyTargets(targets)
    })
  }

  /** 正在等待新字形采样，期间不触发自动轮播 */
  private awaiting = false

  private applyTargets(targets: Float32Array) {
    for (let i = 0; i < this.n; i++) {
      this.tx[i] = targets[i * 2]
      this.ty[i] = targets[i * 2 + 1]
    }
    this.setPhase('forming')
  }

  private scatter(origin?: { x: number; y: number }) {
    const ox = origin?.x ?? this.w / 2
    const oy = origin?.y ?? this.h / 2
    for (let i = 0; i < this.n; i++) {
      let dx = this.x[i] - ox
      let dy = this.y[i] - oy
      const d = Math.hypot(dx, dy) || 1
      dx /= d
      dy /= d
      const a = (Math.random() - 0.5) * 1.6
      const cos = Math.cos(a)
      const sin = Math.sin(a)
      const power = (origin ? 7 : 4.2) * (0.35 + Math.random()) * (origin ? Math.max(0.35, 1 - d / (this.w * 0.7)) : 1)
      this.vx[i] += (dx * cos - dy * sin) * power
      this.vy[i] += (dx * sin + dy * cos) * power * 0.8
      this.free[i] = Math.min(1, this.free[i] + 0.55 + Math.random() * 0.45)
    }
    this.opts.onScatter?.()
    this.setPhase('scattering')
  }

  private setPhase(p: Phase) {
    this.phase = p
    this.phaseStart = this.clock
  }

  /* ---------- 控制 ---------- */

  setSequence(seq: Composition[]) {
    this.sequence = seq
  }

  /** 播放序列里的下一个名称 */
  next(origin?: { x: number; y: number }) {
    if (!this.sequence.length) return
    this.autoplay = true
    this.holdMs = HOLD_MS
    this.index = (this.index + 1) % this.sequence.length
    const comp = this.sequence[this.index]
    this.retarget(comp, this.current !== null, origin)
  }

  /** 显示一段自定义文字（例如用户输入的目标岗位），停留更久 */
  show(comp: Composition, holdMs = 9000) {
    this.autoplay = true
    this.holdMs = holdMs
    this.retarget(comp, this.current !== null)
  }

  start() {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now()
    if (this.index < 0 && !this.opts.reducedMotion) this.next()
    if (this.opts.reducedMotion) {
      if (this.index < 0) this.next()
      this.reducedTimer = window.setInterval(() => this.next(), HOLD_MS + 1600)
      return
    }
    this.raf = requestAnimationFrame(this.loop)
  }

  private reducedTimer = 0

  stop() {
    this.running = false
    cancelAnimationFrame(this.raf)
    window.clearInterval(this.reducedTimer)
  }

  setVisible(v: boolean) {
    this.visible = v
    if (v && this.running && !this.opts.reducedMotion) {
      cancelAnimationFrame(this.raf)
      this.lastTime = performance.now()
      this.raf = requestAnimationFrame(this.loop)
    }
  }

  destroy() {
    this.stop()
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave)
  }

  /* ---------- 指针 ---------- */

  private local(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  private onPointerMove = (e: PointerEvent) => {
    const p = this.local(e)
    const now = performance.now()
    if (this.pointer.lastMove && now - this.pointer.lastMove < 120) {
      const dt = Math.max(8, now - this.pointer.lastMove)
      const k = STEP_MS / dt
      // 平滑后的指针速度（每个模拟步的位移）
      this.pointer.vx = this.pointer.vx * 0.4 + (p.x - this.pointer.x) * k * 0.6
      this.pointer.vy = this.pointer.vy * 0.4 + (p.y - this.pointer.y) * k * 0.6
    } else {
      this.pointer.vx = 0
      this.pointer.vy = 0
    }
    this.pointer.x = p.x
    this.pointer.y = p.y
    this.pointer.lastMove = now
  }

  private onPointerDown = (e: PointerEvent) => {
    const p = this.local(e)
    this.pointer.downX = p.x
    this.pointer.downY = p.y
    this.pointer.downAt = performance.now()
  }

  private onPointerUp = (e: PointerEvent) => {
    const p = this.local(e)
    const moved = Math.hypot(p.x - this.pointer.downX, p.y - this.pointer.downY)
    if (moved < 8 && performance.now() - this.pointer.downAt < 450) this.next(p)
  }

  private onPointerLeave = () => {
    this.pointer.lastMove = 0
    this.pointer.vx = 0
    this.pointer.vy = 0
  }

  /* ---------- 模拟 ---------- */

  private loop = (now: number) => {
    if (!this.running || !this.visible) return
    let dt = now - this.lastTime
    this.lastTime = now
    if (dt > 100) dt = STEP_MS // 切回标签页时不要一次补太多步
    this.acc += dt
    let steps = 0
    while (this.acc >= STEP_MS && steps < 3) {
      this.step()
      this.acc -= STEP_MS
      steps++
    }
    if (steps === 3) this.acc = 0
    this.draw()
    this.raf = requestAnimationFrame(this.loop)
  }

  /** 仅供开发调试：在页面不可见时手动推进模拟并绘制 */
  debugAdvance(steps: number) {
    for (let i = 0; i < steps; i++) this.step()
    this.draw()
    return { phase: this.phase, caption: this.current?.caption }
  }

  /** 仅供开发调试：模拟指针沿直线划过 */
  debugStir(x0: number, y0: number, x1: number, y1: number, steps: number) {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      this.pointer.vx = (x1 - x0) / steps
      this.pointer.vy = (y1 - y0) / steps
      this.pointer.x = x0 + (x1 - x0) * t
      this.pointer.y = y0 + (y1 - y0) * t
      this.pointer.lastMove = performance.now()
      this.step()
    }
    this.draw()
  }

  private step() {
    this.clock += STEP_MS
    const t = this.clock - this.phaseStart
    const now = performance.now()
    const pointerActive = now - this.pointer.lastMove < 90
    const recentlyPlayed = now - this.pointer.lastMove < 1400

    if (this.phase === 'forming' && t > FORM_RAMP + 250) {
      this.setPhase('holding')
      if (this.current) this.opts.onFormed?.(this.current)
    } else if (this.phase === 'holding' && this.autoplay && !this.awaiting && t > this.holdMs && !recentlyPlayed) {
      this.next()
    } else if (this.phase === 'scattering' && t > SCATTER_MS && this.pendingTargets) {
      const targets = this.pendingTargets
      this.pendingTargets = null
      this.applyTargets(targets)
    }

    const phase = this.phase
    let spring = 0.062
    if (phase === 'scattering' || phase === 'idle') spring = 0
    else if (phase === 'forming') {
      const r = Math.min(1, (this.clock - this.phaseStart) / FORM_RAMP)
      spring *= r * r * (3 - 2 * r)
    }

    const time = this.clock * 0.001
    const px = this.pointer.x
    const py = this.pointer.y
    const pvx = this.pointer.vx
    const pvy = this.pointer.vy
    const speed = Math.hypot(pvx, pvy)
    const R = 30 + Math.min(26, speed * 1.1)
    const R2 = R * R
    const holding = phase === 'holding'

    for (let i = 0; i < this.n; i++) {
      let x = this.x[i]
      let y = this.y[i]
      let vx = this.vx[i]
      let vy = this.vy[i]
      let free = this.free[i]

      // 指针带动：只在移动时生效，粒子获得与指针相近的速度，形成拖尾
      if (pointerActive && speed > 0.4) {
        const dx = x - px
        const dy = y - py
        const d2 = dx * dx + dy * dy
        if (d2 < R2) {
          const f = 1 - Math.sqrt(d2) / R
          const g = f * f
          vx += (pvx - vx) * g * 0.55
          vy += (pvy - vy) * g * 0.55
          free = Math.min(1, free + g * 0.8)
        }
      }

      // 弹回字形：被扰动的粒子弹簧更弱，所以会先顺着流动一段再回来
      const k = spring * this.kMul[i] * (1 - free * 0.94)
      let ax = (this.tx[i] - x) * k
      let ay = (this.ty[i] - y) * k

      // 流场：散开和被扰动时，让粒子沿着平滑的涡流走，而不是直线
      if (free > 0.04 || phase === 'scattering') {
        const ang =
          (Math.sin(x * 0.0105 + time * 0.9) + Math.cos(y * 0.0123 - time * 0.7) + Math.sin((x + y) * 0.006 + time * 0.4)) * 2.1
        const amp = 0.05 + free * 0.16
        ax += Math.cos(ang) * amp
        ay += Math.sin(ang) * amp
      } else if (holding) {
        // 停留时轻微的颗粒呼吸，让字“活着”但保持清晰
        ax += (Math.random() - 0.5) * 0.035
        ay += (Math.random() - 0.5) * 0.035
      }

      const friction = phase === 'scattering' ? 0.93 : 0.84 + free * 0.115
      vx = (vx + ax) * friction
      vy = (vy + ay) * friction
      if (phase === 'forming') {
        const sp = vx * vx + vy * vy
        if (sp > MAX_FORM_SPEED2) {
          const r = Math.sqrt(MAX_FORM_SPEED2 / sp)
          vx *= r
          vy *= r
        }
      }
      x += vx
      y += vy

      this.x[i] = x
      this.y[i] = y
      this.vx[i] = vx
      this.vy[i] = vy
      this.free[i] = free * (phase === 'scattering' ? 0.995 : 0.976)
    }
  }

  private draw() {
    const ctx = this.ctx
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.w, this.h)
    // 全部画成细小的方点：拖尾和流线来自点的疏密，而不是线条
    for (const b of this.buckets) {
      ctx.fillStyle = b.color
      ctx.beginPath()
      for (let j = 0; j < b.idx.length; j++) {
        const i = b.idx[j]
        const s = this.size[i] * this.grain
        ctx.rect(this.x[i] - s / 2, this.y[i] - s / 2, s, s)
      }
      ctx.fill()
    }
  }
}
