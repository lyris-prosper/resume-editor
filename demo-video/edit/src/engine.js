/**
 * 逐帧合成引擎：renderAt(t) 只由时间 t 决定画面，便于多进程并行截帧、结果可复现。
 * 层次：纸面背景 → 开场文字 → 品牌粒子 → 实操窗口（真实录屏帧 + 推近 + 标注）→ 顶部步骤 / 底部说明 → 收束。
 */
import { STEPS, FPS, DURATION, OPS_START, OUTRO_THUMBS, build } from './timeline.js'

const TL = build()
const OPS_END = TL.opsEnd
const FRAMES = { seg01: 1288, seg02: 1916, seg03: 1648, seg04: 1774 }
const PAGE_W = 1440
const PAGE_H = 810
const WIN = { x: 160, y: 100, w: 1600, h: 900 }
const COLORS = { blue: '#0a84ff', orange: '#c2571a', ink: '#111111' }

/* ---------------- 小工具 ---------------- */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const lerp = (a, b, p) => a + (b - a) * p
const prog = (t, t0, dur) => clamp((t - t0) / dur)
const easeOut = (p) => 1 - Math.pow(1 - p, 3)
const easeIn = (p) => p * p * p
const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
const easeOutBack = (p) => 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2)
/** 渐入渐出：t 在 [t0, t1] 内为 1，两端各 fi / fo 秒过渡 */
const window01 = (t, t0, t1, fi = 0.35, fo = 0.3) => Math.min(easeOut(prog(t, t0, fi)), 1 - easeIn(prog(t, t1 - fo, fo)))
const $ = (s) => document.querySelector(s)
const css = (el, o) => Object.assign(el.style, o)
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ---------------- 录屏帧 ---------------- */
const cache = new Map()
function frameUrl(seg, n) {
  return `/frames/${seg}/${String(n).padStart(6, '0')}.jpg`
}
function frameIndex(seg, s) {
  return clamp(Math.round(s * FPS) + 1, 1, FRAMES[seg])
}
async function loadImage(url) {
  if (cache.has(url)) return cache.get(url)
  const img = new Image()
  img.src = url
  const p = img.decode().then(() => img)
  cache.set(url, p)
  if (cache.size > 24) cache.delete(cache.keys().next().value)
  return p
}

/* ---------------- 片段与相机 ---------------- */
function clipAt(t) {
  const cs = TL.clips
  if (t < cs[0].start) return { clip: cs[0], s: cs[0].a, i: 0 }
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i]
    if (t < c.end || i === cs.length - 1) {
      const s = Math.min(c.b, c.a + (t - c.start) * c.speed)
      return { clip: c, s, i }
    }
  }
}

function normCam(k) {
  let cx = PAGE_W / 2
  let cy = PAGE_H / 2
  let z = 1
  if (k.c) [cx, cy, z] = [k.c[0], k.c[1], k.z ?? 1.3]
  else if (k.rect) {
    const [x, y, w, h] = k.rect
    const pad = k.pad ?? 40
    z = Math.min(PAGE_W / (w + 2 * pad), PAGE_H / (h + 2 * pad), k.zmax ?? 1.6)
    cx = x + w / 2
    cy = y + h / 2
  }
  return clampCam({ cx, cy, z })
}
function clampCam({ cx, cy, z }) {
  z = Math.max(1, z)
  const vw = PAGE_W / z
  const vh = PAGE_H / z
  return { cx: clamp(cx, vw / 2, PAGE_W - vw / 2), cy: clamp(cy, vh / 2, PAGE_H - vh / 2), z }
}
const CAM_KEYS = TL.clips
  .flatMap((c) => (c.cams ?? []).map((k) => ({ T: c.start + (k.at ?? 0), dur: Math.max(0.01, k.dur ?? 0.6), target: normCam(k) })))
  .sort((a, b) => a.T - b.T)

function camAt(t) {
  let cur = { cx: PAGE_W / 2, cy: PAGE_H / 2, z: 1 }
  for (const k of CAM_KEYS) {
    if (t >= k.T + k.dur) cur = k.target
    else if (t >= k.T) {
      const p = easeInOut((t - k.T) / k.dur)
      // 倍率按对数插值，推近拉远的速度感更均匀
      const z = Math.exp(lerp(Math.log(cur.z), Math.log(k.target.z), p))
      cur = clampCam({ cx: lerp(cur.cx, k.target.cx, p), cy: lerp(cur.cy, k.target.cy, p), z })
      break
    } else break
  }
  return cur
}
/** 页面 CSS 坐标 → 窗口画布坐标 */
function mapper(cam) {
  const vw = PAGE_W / cam.z
  const vh = PAGE_H / cam.z
  const left = cam.cx - vw / 2
  const top = cam.cy - vh / 2
  const k = WIN.w / vw
  return { k, x: (x) => (x - left) * k, y: (y) => (y - top) * k, src: [left * 2, top * 2, vw * 2, vh * 2] }
}

/* ---------------- 窗口：录屏 + 标注 ---------------- */
const wc = $('#wc')
const wctx = wc.getContext('2d')
wctx.imageSmoothingEnabled = true
wctx.imageSmoothingQuality = 'high'

async function drawWindow(t) {
  const { clip, s, i } = clipAt(t)
  const cam = camAt(t)
  const m = mapper(cam)
  const img = await loadImage(frameUrl(clip.seg, frameIndex(clip.seg, s)))
  let prevImg = null
  let mix = 1
  if (clip.trans === 'dissolve' && i > 0 && t >= clip.start && t < clip.start + clip.tdur) {
    const prev = TL.clips[i - 1]
    prevImg = await loadImage(frameUrl(prev.seg, frameIndex(prev.seg, prev.b)))
    mix = easeInOut((t - clip.start) / clip.tdur)
  }
  wctx.globalAlpha = 1
  wctx.fillStyle = '#fff'
  wctx.fillRect(0, 0, WIN.w, WIN.h)
  if (prevImg) {
    wctx.drawImage(prevImg, ...m.src, 0, 0, WIN.w, WIN.h)
    wctx.globalAlpha = mix
  }
  wctx.drawImage(img, ...m.src, 0, 0, WIN.w, WIN.h)
  wctx.globalAlpha = 1
  drawFx(t, m)
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

const FX = TL.clips.flatMap((c) => c.fx ?? [])
function drawFx(t, m) {
  const ctx = wctx
  for (const f of FX) {
    if (t < f.t0 || t > f.t1 + 0.3) continue
    const a = window01(t, f.t0, f.t1 + 0.25, 0.35, 0.25)
    if (a <= 0) continue
    if (f.type === 'veil') {
      const [x, y, w, h] = f.rect
      const p = 10
      ctx.save()
      ctx.fillStyle = `rgba(255,255,255,${0.5 * a})`
      ctx.beginPath()
      ctx.rect(0, 0, WIN.w, WIN.h)
      roundRect(ctx, m.x(x - p), m.y(y - p), (w + 2 * p) * m.k, (h + 2 * p) * m.k, 14 * m.k)
      ctx.fill('evenodd')
      ctx.restore()
    } else if (f.type === 'box') {
      const [x, y, w, h] = f.rect
      const grow = (1 - easeOut(prog(t, f.t0, 0.4))) * 10
      const p = 6 + grow
      const col = COLORS[f.color] ?? COLORS.ink
      ctx.save()
      ctx.globalAlpha = a
      ctx.lineWidth = 2.6
      ctx.strokeStyle = col
      ctx.shadowColor = f.color === 'ink' ? 'rgba(17,17,17,0.18)' : col + '66'
      ctx.shadowBlur = 14
      roundRect(ctx, m.x(x - p), m.y(y - p), (w + 2 * p) * m.k, (h + 2 * p) * m.k, Math.min(12 * m.k, 16))
      ctx.stroke()
      ctx.restore()
    } else if (f.type === 'arrow') {
      const p = easeInOut(prog(t, f.t0, 0.45))
      const [x0, y0] = [m.x(f.from[0]), m.y(f.from[1])]
      const [x1, y1] = [m.x(f.to[0]), m.y(f.to[1])]
      const cx = (x0 + x1) / 2
      const cy = Math.min(y0, y1) - Math.abs(x1 - x0) * 0.18 - 10
      const pt = (u) => [(1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * cx + u * u * x1, (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cy + u * u * y1]
      ctx.save()
      ctx.globalAlpha = a
      ctx.strokeStyle = COLORS.ink
      ctx.lineWidth = 2.4
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      const N = 40
      for (let k = 0; k <= N * p; k++) {
        const [px, py] = pt(k / N)
        if (k === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
      if (p > 0.95) {
        const [ax, ay] = pt(1)
        const [bx, by] = pt(0.94)
        const ang = Math.atan2(ay - by, ax - bx)
        ctx.beginPath()
        ctx.moveTo(ax - 13 * Math.cos(ang - 0.5), ay - 13 * Math.sin(ang - 0.5))
        ctx.lineTo(ax, ay)
        ctx.lineTo(ax - 13 * Math.cos(ang + 0.5), ay - 13 * Math.sin(ang + 0.5))
        ctx.stroke()
      }
      ctx.restore()
    }
  }
}

/* ---------------- 顶部步骤 + 底部说明 ---------------- */
function fillTitle(el, step, subIndex) {
  el.querySelector('.t-num').textContent = step.num
  el.querySelector('.t-name').textContent = step.title
  const subs = el.querySelector('.t-subs')
  const key = `${step.num}:${subIndex}`
  if (subs.dataset.key === key) return
  subs.dataset.key = key
  subs.innerHTML = step.subs
    .map((s, i) => `${i ? '<span class="sep"></span>' : ''}<span class="${i === subIndex ? 'on' : i < subIndex ? 'done' : ''}">${s}</span>`)
    .join('')
}
const progressEl = $('#t-progress')
progressEl.innerHTML = STEPS.map((s) => `<div class="p-item"><b>${s.num}</b>${s.short}<div class="p-bar"><i></i></div></div>`).join('')

function drawTop(t) {
  const top = $('#top')
  const a = Math.min(easeOut(prog(t, 13.45, 0.55)), 1 - easeIn(prog(t, OPS_END - 0.05, 0.45)))
  top.style.opacity = a
  if (a <= 0) return
  const { clip } = clipAt(Math.max(t, OPS_START))
  const si = clip.step
  const step = STEPS[si]
  const cur = $('#t-cur')
  const prev = $('#t-prev')
  fillTitle(cur, step, clip.sub)
  const tp = si > 0 ? prog(t, step.start - 0.05, 0.55) : 1
  if (tp < 1) {
    fillTitle(prev, STEPS[si - 1], STEPS[si - 1].subs.length)
    const e = easeInOut(tp)
    css(prev, { opacity: 1 - e, transform: `translateY(${-16 * e}px)` })
    css(cur, { opacity: e, transform: `translateY(${16 * (1 - e)}px)` })
  } else {
    css(prev, { opacity: 0 })
    css(cur, { opacity: 1, transform: 'none' })
  }
  ;[...progressEl.children].forEach((item, i) => {
    const s = STEPS[i]
    item.className = `p-item ${i === si ? 'on' : i < si ? 'done' : ''}`
    item.querySelector('i').style.width = `${clamp((t - s.start) / (s.end - s.start)) * 100}%`
  })
}

const CAPS = STEPS.flatMap((s) => s.captions)
function drawBottom(t) {
  const els = [$('#cap-a'), $('#cap-b')]
  const live = CAPS.filter((c) => t >= c.t0 - 0.01 && t <= c.t1 + 0.35)
  els.forEach((el, i) => {
    const c = live[i]
    if (!c) return css(el, { opacity: 0 })
    if (el.textContent !== c.text) el.textContent = c.text
    el.className = `cap ${c.text.includes('缺少') ? 'orange' : ''}`
    const a = window01(t, c.t0, c.t1 + 0.3, 0.4, 0.3)
    css(el, { opacity: a, transform: `translateY(${(1 - easeOut(prog(t, c.t0, 0.45))) * 12}px)` })
  })
  const r = TL.record
  css($('#badge'), { opacity: window01(t, r.b0, r.b1 + 0.3, 0.4, 0.3) })
}

/* ---------------- 虚构示例压测记录卡（视频包装） ---------------- */
const recCard = $('#rec-card')
recCard.querySelector('.rec-title').textContent = TL.record.title
recCard.querySelector('.rec-rows').innerHTML = TL.record.rows.map(([k, v]) => `<div class="rec-row"><span>${k}</span><b>${v}</b></div>`).join('')
recCard.querySelector('.rec-note').textContent = TL.record.note
let recH = 0
function drawRecord(t) {
  const r = TL.record
  const layer = $('#record')
  if (t < r.t0 - 0.05 || t > r.t1 + 0.5) return css(layer, { opacity: 0 })
  if (!recH) recH = recCard.offsetHeight
  const appear = easeOut(prog(t, r.t0, 0.45))
  const dock = easeInOut(prog(t, r.tDock, 0.65))
  const out = 1 - easeIn(prog(t, r.t1, 0.4))
  const center = { x: 960 - 300, y: 535 - recH / 2, s: 0.94 + 0.06 * appear }
  const docked = { x: 1398, y: 286, s: 0.6 }
  const x = lerp(center.x, docked.x, dock)
  const y = lerp(center.y, docked.y, dock)
  const s = lerp(center.s, docked.s, dock)
  css(layer, { opacity: appear * out })
  css(recCard, { transform: `translate(${x}px, ${y}px) scale(${s})` })
  // 居中时把背后的界面压淡，停靠后恢复
  return (1 - dock) * appear * out
}

/* ---------------- 开场 0–8s ---------------- */
function splitChars(el, text, wordMarks = []) {
  let html = ''
  let i = 0
  while (i < text.length) {
    const w = wordMarks.find((m) => text.startsWith(m, i))
    if (w) {
      html += `<span class="i-word">${[...w].map((ch) => `<span class="ch">${ch}</span>`).join('')}</span>`
      i += w.length
    } else {
      html += `<span class="ch">${text[i] === ' ' ? '&nbsp;' : text[i]}</span>`
      i++
    }
  }
  el.innerHTML = html
  return [...el.querySelectorAll('.ch')]
}
const L1 = splitChars($('#i-l1'), '做过不少事。')
const L2 = splitChars($('#i-l2'), '简历里，却只剩「负责、参与、协助」。', ['负责', '参与', '协助'])
const L2W = [...$('#i-l2').querySelectorAll('.i-word')]
const L3 = splitChars($('#i-l3'), '把经历里的依据，写进简历。')

function charsIn(chars, t, t0, stagger, dur = 0.5, dy = 22) {
  chars.forEach((ch, i) => {
    const p = easeOut(prog(t, t0 + i * stagger, dur))
    css(ch, { opacity: p, transform: `translateY(${(1 - p) * dy}px)`, filter: p < 1 ? `blur(${(1 - p) * 6}px)` : 'none' })
  })
}

let introGeom = null
function drawIntro(t) {
  const layer = $('#intro')
  if (t > 8.2) return css(layer, { display: 'none' })
  css(layer, { display: 'block' })
  const l1 = $('#i-l1')
  const l2 = $('#i-l2')
  const l3 = $('#i-l3')
  const sample = $('#i-sample')
  // 第一拍
  charsIn(L1, t, 0.35, 0.11, 0.55)
  const up = easeInOut(prog(t, 1.85, 0.6))
  const gone = easeInOut(prog(t, 3.8, 0.45))
  css(l1, { top: `${lerp(400, 300, up) - gone * 40}px`, transform: `scale(${lerp(1, 0.72, up)})`, color: up > 0 ? `rgb(${lerp(17, 140, up)},${lerp(17, 140, up)},${lerp(17, 140, up)})` : '#111', opacity: 1 - gone })
  // 第二拍
  charsIn(L2, t, 2.0, 0.028, 0.5, 16)
  L2W.forEach((w, i) => w.style.setProperty('--w', easeOut(prog(t, 2.75 + i * 0.22, 0.35)).toFixed(3)))
  css(l2, { top: `${450 - gone * 40}px`, opacity: 1 - gone })
  // 示例原文与追问
  if (!introGeom) {
    const key = $('#i-key').getBoundingClientRect()
    const sen = $('.i-sentence').getBoundingClientRect()
    introGeom = { kx: key.left + key.width / 2, ky: key.top + key.height / 2, sl: sen.left, st: sen.top }
  }
  const show = easeOut(prog(t, 4.05, 0.55))
  const zoom = easeInOut(prog(t, 4.95, 0.75))
  const leave = easeInOut(prog(t, 6.45, 0.45))
  const S = lerp(1, 1.75, zoom)
  const tx = lerp(0, 960 - introGeom.kx, zoom)
  const ty = lerp(0, 448 - introGeom.ky, zoom)
  css(sample, { opacity: show * (1 - leave), transform: `translateY(${(1 - show) * 18 - leave * 30}px)` })
  css($('.i-sentence'), { transformOrigin: `${introGeom.kx - introGeom.sl}px ${introGeom.ky - introGeom.st}px`, transform: `translate(${tx}px, ${ty}px) scale(${S})` })
  css($('.i-label'), { opacity: 1 - zoom })
  for (const sel of ['#i-pre', '#i-post', '.i-dot']) css($(sel), { opacity: lerp(1, 0.18, zoom), filter: `blur(${zoom * 2.5}px)` })
  $('#i-key').style.setProperty('--box', easeOut(prog(t, 5.35, 0.4)).toFixed(3))
  const qs = [
    { el: $('#i-q1'), t0: 5.75, x: 700, y: 580 },
    { el: $('#i-q2'), t0: 6.05, x: 1010, y: 580 },
  ]
  qs.forEach((q, i) => {
    const p = prog(t, q.t0, 0.42)
    const e = easeOutBack(p)
    css(q.el, { left: `${q.x}px`, top: `${q.y}px`, opacity: easeOut(p), transform: `translateY(${(1 - e) * 18}px) scale(${0.9 + 0.1 * e})` })
    const path = $(i ? '#i-ql2' : '#i-ql1')
    const w = q.el.offsetWidth || 210
    const ex = q.x + w / 2
    path.setAttribute('d', `M ${960 + (i ? 70 : -70)} 498 Q ${(960 + ex) / 2} ${540} ${ex} ${q.y - 4}`)
    path.style.opacity = easeOut(prog(t, q.t0 - 0.1, 0.3)) * 0.7
  })
  // 收束句
  charsIn(L3, t, 6.75, 0.05, 0.5)
  const toParticles = easeInOut(prog(t, 7.72, 0.22))
  css(l3, { top: '462px', opacity: 1 - toParticles })
}

/* ---------------- 品牌粒子 8–14s（包装动画） ---------------- */
const pc = $('#particles')
const pctx = pc.getContext('2d')
let P = null
function sampleText(text, font, cx, cy, spacing, n, seed) {
  const c = document.createElement('canvas')
  c.width = 1920
  c.height = 1080
  const x = c.getContext('2d')
  x.font = font
  x.letterSpacing = spacing
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.fillStyle = '#000'
  x.fillText(text, cx, cy)
  const d = x.getImageData(0, 0, 1920, 1080).data
  const pts = []
  for (let yy = 0; yy < 1080; yy += 2) for (let xx = 0; xx < 1920; xx += 2) if (d[(yy * 1920 + xx) * 4 + 3] > 140) pts.push([xx, yy])
  const r = rng(seed)
  const out = []
  for (let i = 0; i < n; i++) {
    const p = pts[Math.floor(r() * pts.length)]
    out.push([p[0] + (r() - 0.5) * 2, p[1] + (r() - 0.5) * 2])
  }
  return out
}
function initParticles() {
  const n = 3200
  css($('#i-l3'), { top: '462px' })
  const l3 = $('#i-l3').getBoundingClientRect()
  const from = sampleText('把经历里的依据，写进简历。', '700 92px "Noto Serif SC"', 960, l3.top + l3.height / 2, '3.7px', n, 7)
  // 品牌名的位置取页面上真实文字的位置，粒子聚合后无缝换成清晰的字
  $('#brand').style.opacity = 0
  const nm = $('#b-name').getBoundingClientRect()
  const to = sampleText('拾历', '700 196px "Noto Serif SC"', nm.left + nm.width / 2 + 9.8, nm.top + nm.height / 2, '19.6px', n, 11)
  const r = rng(3)
  P = Array.from({ length: n }, (_, i) => ({
    x0: from[i][0],
    y0: from[i][1],
    x1: to[i][0],
    y1: to[i][1],
    ang: r() * Math.PI * 2,
    dist: 40 + r() * 220,
    delay: r() * 0.55,
    dur: 1.05 + r() * 0.35,
    size: 1.3 + r() * 1.5,
    tone: Math.floor(20 + r() * 90),
    alpha: 0.55 + r() * 0.4,
    swirl: (r() - 0.5) * 160,
    ph: r() * 6.28,
  }))
}
function drawParticles(t) {
  if (t < 7.7 || t > 10.9) return css(pc, { display: 'none' })
  css(pc, { display: 'block' })
  pctx.clearRect(0, 0, 1920, 1080)
  const appear = easeOut(prog(t, 7.72, 0.22))
  const fade = 1 - easeInOut(prog(t, 10.05, 0.6))
  for (const q of P) {
    const burst = easeOut(prog(t, 7.85, 0.8))
    const bx = q.x0 + Math.cos(q.ang) * q.dist * burst
    const by = q.y0 + Math.sin(q.ang) * q.dist * burst * 0.75
    const p = easeInOut(prog(t, 8.45 + q.delay, q.dur))
    const sw = Math.sin(Math.PI * p) * q.swirl
    const wob = (1 - p) * burst * 6
    const x = lerp(bx, q.x1, p) + sw * 0.35 + Math.sin(t * 3 + q.ph) * wob
    const y = lerp(by, q.y1, p) - sw * 0.25 + Math.cos(t * 2.6 + q.ph) * wob
    pctx.globalAlpha = q.alpha * appear * fade
    pctx.fillStyle = `rgb(${q.tone},${q.tone},${q.tone})`
    const s = q.size * (1 - 0.25 * p)
    pctx.fillRect(x - s / 2, y - s / 2, s, s)
  }
  pctx.globalAlpha = 1
}
function drawBrand(t) {
  const layer = $('#brand')
  if (t < 9.7 || t > 14.1) return css(layer, { opacity: 0 })
  const leave = easeInOut(prog(t, 12.95, 0.6))
  css(layer, { opacity: 1 - leave, transform: `translateY(${-30 * leave}px) scale(${1 - 0.04 * leave})` })
  css($('#b-name'), { opacity: easeInOut(prog(t, 9.95, 0.5)) })
  const ic = prog(t, 10.05, 0.5)
  css($('#b-icon'), { opacity: easeOut(ic), transform: `translateY(${(1 - easeOutBack(ic)) * 16}px) scale(${0.86 + 0.14 * easeOutBack(ic)})` })
  const tg = easeOut(prog(t, 10.55, 0.5))
  css($('#b-tag'), { opacity: tg, transform: `translateY(${(1 - tg) * 16}px)` })
  ;[...$('#b-steps').children].forEach((el, i) => {
    const p = easeOut(prog(t, 11.15 + i * 0.24, 0.4))
    css(el, { opacity: p, transform: `translateY(${(1 - p) * 14}px)` })
  })
}

/* ---------------- 窗口出入场 ---------------- */
function winState(t) {
  const enter = easeOut(prog(t, 13.1, 0.85))
  const leave = easeInOut(prog(t, OPS_END - 0.05, 0.6))
  return { a: enter * (1 - leave), y: (1 - enter) * 60 - leave * 20, s: (0.95 + 0.05 * enter) * (1 - 0.06 * leave) }
}

/* ---------------- 收束 82–90s ---------------- */
async function initOutro() {
  const { library, job } = OUTRO_THUMBS
  const nodes = [
    [library, $('#o-n1 canvas')],
    [job, $('#o-n2 canvas')],
  ]
  for (const [spec, cv] of nodes) {
    const img = await loadImage(frameUrl(spec.seg, frameIndex(spec.seg, spec.t)))
    const [x, y, w, h] = spec.crop
    const c = cv.getContext('2d')
    c.imageSmoothingQuality = 'high'
    c.drawImage(img, x * 2, y * 2, w * 2, h * 2, 0, 0, cv.width, cv.height)
  }
  const paper = new Image()
  paper.src = '/footage-final/resume-export.png'
  await paper.decode()
  const c3 = $('#o-n3 canvas').getContext('2d')
  c3.imageSmoothingQuality = 'high'
  c3.fillStyle = '#fff'
  c3.fillRect(0, 0, 960, 600)
  c3.drawImage(paper, 0, 0, 2480, 1550, 0, 0, 960, 600)
  // 箭头路径
  $('#o-a1').setAttribute('d', 'M 642 450 L 708 450')
  $('#o-a2').setAttribute('d', 'M 1212 450 L 1278 450')
  $('#o-back').setAttribute('d', 'M 1530 732 C 1530 840, 1240 838, 960 838 C 680 838, 390 840, 390 740')
  for (const id of ['#o-a1', '#o-a2', '#o-back']) {
    const p = $(id)
    const len = p.getTotalLength()
    p.dataset.len = len
    p.style.strokeDasharray = `${len} ${len}`
  }
}
function drawOutro(t) {
  const layer = $('#outro')
  const u = t - OPS_END
  if (u < -0.1) return css(layer, { display: 'none' })
  css(layer, { display: 'block' })
  const toEnd = easeInOut(prog(u, 4.3, 0.7))
  css($('#o-nodes'), { opacity: 1 - toEnd, transform: `translateX(${-60 * toEnd}px)` })
  ;['#o-n1', '#o-n2', '#o-n3'].forEach((id, i) => {
    const p = prog(u, 0.3 + i * 0.5, 0.55)
    css($(id), { opacity: easeOut(p), transform: `translateY(${(1 - easeOutBack(p)) * 26}px)` })
  })
  const arrow = (id, t0, d) => {
    const el = $(id)
    const len = +el.dataset.len
    const p = easeInOut(prog(u, t0, d))
    el.style.strokeDashoffset = `${len * (1 - p)}`
    el.style.opacity = p > 0 ? 1 : 0
  }
  arrow('#o-a1', 0.7, 0.4)
  arrow('#o-a2', 1.2, 0.4)
  arrow('#o-back', 1.95, 0.85)
  const bl = easeOut(prog(u, 2.35, 0.5))
  css($('#o-backlabel'), { opacity: bl, transform: `translateY(${(1 - bl) * 12}px)` })
  // 品牌与成稿：至少停留 3 秒
  const end = $('#o-end')
  css(end, { opacity: toEnd })
  const pp = easeOut(prog(u, 4.4, 0.8))
  css($('#o-paper'), { transform: `translateY(${(1 - pp) * 40}px)` })
  const bb = easeOut(prog(u, 4.65, 0.8))
  css($('#o-brand'), { opacity: bb, transform: `translateX(${(1 - bb) * 30}px)` })
  css($('#o-foot'), { opacity: easeOut(prog(u, 5.2, 0.6)) })
}

/* ---------------- 封面 ---------------- */
async function drawCover() {
  const layer = $('#cover')
  layer.innerHTML = `
    <div style="position:absolute;left:150px;top:0;bottom:0;width:860px;display:flex;flex-direction:column;justify-content:center">
      <div style="display:flex;align-items:center;gap:30px"><img src="/brand/icon-256.png" style="width:120px;height:120px;filter:drop-shadow(0 12px 16px rgb(17 17 17/.16))"><span style="font-size:156px;font-weight:700;letter-spacing:.1em;line-height:1">拾历</span></div>
      <div style="margin-top:34px;font-size:50px;font-weight:600;letter-spacing:.14em">拾起经历，呈现实力。</div>
      <div style="margin-top:30px;font-size:27px;line-height:1.75;letter-spacing:.06em;color:#4d4d4d">把经历整理成事实库，补上真实依据再改写，<br>按岗位选出有依据的内容，生成一页简历。</div>
      <div class="cv-steps" style="margin-top:44px;display:flex;gap:12px;align-items:center;font-size:23px;font-weight:600;letter-spacing:.06em;white-space:nowrap">
        <span class="b-step" style="padding:10px 22px">整理事实</span><span class="b-arrow">→</span><span class="b-step" style="padding:10px 22px">补充依据</span><span class="b-arrow">→</span><span class="b-step" style="padding:10px 22px">对准岗位</span><span class="b-arrow">→</span><span class="b-step" style="padding:10px 22px">存回复用</span>
      </div>
    </div>
    <div style="position:absolute;left:1180px;top:110px;width:600px;height:850px;border-radius:6px;overflow:hidden;background:#fff;box-shadow:0 0 0 1px rgb(17 17 17/.08),0 40px 80px -36px rgb(17 17 17/.5)"><img src="/footage-final/resume-export.png" style="width:100%;display:block"></div>
    <div id="cv-card" style="position:absolute;left:960px;top:560px;width:640px;height:400px;border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 0 0 1px rgb(17 17 17/.1),0 36px 70px -30px rgb(17 17 17/.5)"><canvas width="1280" height="800" style="width:640px;height:400px;display:block"></canvas></div>
    <div style="position:absolute;left:150px;bottom:44px;font-size:17px;letter-spacing:.12em;color:#9a9a9a">黑客松产品 Demo · 演示人物与数据均为虚构</div>`
  const img = await loadImage(frameUrl('seg02', frameIndex('seg02', 45.0)))
  const cv = layer.querySelector('#cv-card canvas')
  const c = cv.getContext('2d')
  c.imageSmoothingQuality = 'high'
  c.drawImage(img, 548 * 2, 196 * 2, 670 * 2, 418 * 2, 0, 0, 1280, 800)
  for (const id of ['#intro', '#particles', '#brand', '#win', '#top', '#bottom', '#record', '#outro']) css($(id), { display: 'none' })
  css(layer, { display: 'block' })
  await document.fonts.ready
}

/* ---------------- 主渲染 ---------------- */
export async function renderAt(t) {
  drawIntro(t)
  drawParticles(t)
  drawBrand(t)
  const w = winState(t)
  const win = $('#win')
  if (w.a > 0.001) {
    css(win, { display: 'block', opacity: w.a, transform: `translateY(${w.y}px) scale(${w.s})` })
    await drawWindow(t)
    const veil = drawRecord(t)
    if (veil > 0) {
      wctx.fillStyle = `rgba(255,255,255,${0.62 * veil})`
      wctx.fillRect(0, 0, WIN.w, WIN.h)
    }
  } else {
    css(win, { display: 'none' })
    drawRecord(t)
  }
  drawTop(t)
  drawBottom(t)
  drawOutro(t)
}

async function init() {
  css($('#cover'), { display: 'none' })
  const texts = document.body.innerText + STEPS.map((s) => s.title + s.subs.join('') + s.short + s.captions.map((c) => c.text).join('')).join('') + '0123456789→·，。'
  const specs = ['400', '500', '600', '700', '900'].flatMap((w) => [`${w} 40px "Noto Serif SC"`, `${w} 40px "Source Serif 4 Variable"`])
  await Promise.all(specs.map((s) => document.fonts.load(s, texts)))
  await document.fonts.ready
  initParticles()
  await initOutro()
}

const params = new URLSearchParams(location.search)
window.__ready = init().then(async () => {
  if (params.has('cover')) return drawCover()
  await renderAt(Number(params.get('t') ?? 0))
})
window.renderAt = renderAt
window.__meta = { opsEnd: OPS_END, steps: STEPS.map((s) => ({ num: s.num, start: s.start, end: s.end })), clips: TL.clips.map((c) => ({ id: c.id, start: c.start, end: c.end })), duration: DURATION }

/* 预览：?preview 打开拖动条，可以逐帧检查 */
if (params.has('preview')) {
  const bar = $('#scrub')
  bar.hidden = false
  const input = bar.querySelector('input')
  const label = bar.querySelector('span')
  let playing = false
  const show = async (f) => {
    await renderAt(f / FPS)
    label.textContent = `${(f / FPS).toFixed(2)}s`
  }
  input.addEventListener('input', () => show(+input.value))
  bar.querySelector('button').addEventListener('click', async () => {
    playing = !playing
    while (playing && +input.value < DURATION * FPS - 1) {
      input.value = +input.value + 1
      await show(+input.value)
    }
  })
}
