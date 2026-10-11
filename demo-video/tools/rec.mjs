// 录制工具：用本机 Chrome 打开演示副本，CDP 录屏 + 记录鼠标轨迹和关键时刻。
// 所有点击、输入都是发给真实页面的输入事件；光标图形在后期按这里记录的轨迹绘制。
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
export const BASE = 'http://localhost:5190'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export async function launch({ width = 1440, height = 810, dsf = 2, headless = process.env.HEADLESS === '1' } = {}) {
  const browser = await chromium.launch({ executablePath: CHROME, headless, args: ['--disable-features=Translate', '--force-color-profile=srgb'] })
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dsf, locale: 'zh-CN', colorScheme: 'light', acceptDownloads: true })
  await context.addInitScript({ path: new URL('./cursor-init.js', import.meta.url).pathname })
  const page = await context.newPage()
  return { browser, context, page, width, height, dsf }
}

/** 一次录制：帧、鼠标、标记都用同一个毫秒时钟 */
export class Take {
  constructor(env, dir) {
    this.env = env
    this.page = env.page
    this.dir = dir
    fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(path.join(dir, 'frames'), { recursive: true })
    this.frames = []
    this.mouse = []
    this.markers = []
    this.pos = { x: env.width * 0.5, y: env.height * 0.62 }
    this.pending = []
  }

  now() {
    return Date.now()
  }

  async start() {
    this.cdp = await this.env.context.newCDPSession(this.page)
    let n = 0
    this.cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
      const t = Date.now()
      const file = `f${String(n++).padStart(6, '0')}.jpg`
      this.frames.push({ t, ts: metadata.timestamp, file })
      this.pending.push(fs.promises.writeFile(path.join(this.dir, 'frames', file), Buffer.from(data, 'base64')))
      this.cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
    })
    await this.cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 92,
      maxWidth: this.env.width * this.env.dsf,
      maxHeight: this.env.height * this.env.dsf,
      everyNthFrame: 1,
    })
    this.t0 = Date.now()
    this.mouse.push({ t: this.t0, x: this.pos.x, y: this.pos.y, k: 'move' })
    this.mark('start')
  }

  /** 页面静止时录屏不出帧：轻推一下，保证每个时刻都有画面 */
  async heartbeat(ms) {
    const end = Date.now() + ms
    while (Date.now() < end) {
      await this.page.evaluate(() => {
        let el = document.getElementById('__hb')
        if (!el) {
          el = document.createElement('div')
          el.id = '__hb'
          el.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:1px;pointer-events:none;z-index:2147483647'
          document.documentElement.appendChild(el)
        }
        el.style.background = el.style.background === 'rgba(255, 255, 255, 0.01)' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.01)'
      }).catch(() => {})
      await sleep(33)
    }
  }

  mark(name, extra = {}) {
    this.markers.push({ t: Date.now(), name, ...extra })
  }

  async wait(ms) {
    await this.heartbeat(ms)
  }

  /** 平滑移动：缓入缓出，轻微弧线，不绕圈 */
  async moveTo(x, y, { duration } = {}) {
    const from = { ...this.pos }
    const dist = Math.hypot(x - from.x, y - from.y)
    if (dist < 1) return
    const d = duration ?? Math.min(1100, Math.max(380, 260 + dist * 0.75))
    const nx = -(y - from.y) / dist
    const ny = (x - from.x) / dist
    const bow = Math.min(40, dist * 0.06)
    const start = Date.now()
    for (;;) {
      const p = Math.min(1, (Date.now() - start) / d)
      const e = ease(p)
      const arc = Math.sin(Math.PI * e) * bow
      const px = from.x + (x - from.x) * e + nx * arc
      const py = from.y + (y - from.y) * e + ny * arc
      await this.page.mouse.move(px, py)
      this.pos = { x: px, y: py }
      this.mouse.push({ t: Date.now(), x: px, y: py, k: 'move' })
      if (p >= 1) break
      await sleep(12)
    }
  }

  async box(target) {
    const loc = typeof target === 'string' ? this.page.locator(target).first() : target
    await loc.waitFor({ state: 'visible', timeout: 60000 })
    const b = await loc.boundingBox()
    if (!b) throw new Error(`no box for ${target}`)
    return b
  }

  /** 指向元素：fx/fy 是元素内的相对位置 */
  async hover(target, { fx = 0.5, fy = 0.5, duration, dwell = 350 } = {}) {
    const b = await this.box(target)
    await this.moveTo(b.x + b.width * fx, b.y + b.height * fy, { duration })
    if (dwell) await this.wait(dwell)
    return b
  }

  async clickAt(x, y, { dwell = 380, after = 250, name } = {}) {
    await this.moveTo(x, y)
    await this.wait(dwell)
    await this.page.mouse.down()
    this.mouse.push({ t: Date.now(), x, y, k: 'down' })
    if (name) this.mark(name, { x, y })
    await sleep(70)
    await this.page.mouse.up()
    this.mouse.push({ t: Date.now(), x, y, k: 'up' })
    await this.wait(after)
  }

  async click(target, opts = {}) {
    const b = await this.box(target)
    const x = b.x + b.width * (opts.fx ?? 0.5)
    const y = b.y + b.height * (opts.fy ?? 0.5)
    await this.clickAt(x, y, opts)
    return b
  }

  async type(text, { delay = 70, name } = {}) {
    if (name) this.mark(`${name}:start`)
    for (const ch of text) {
      await this.page.keyboard.type(ch)
      await this.wait(delay)
    }
    if (name) this.mark(`${name}:end`)
  }

  /** 平滑滚动：在 (x, y) 处用滚轮滚动 dy 像素 */
  async scroll(dy, { x, y, duration = 900, name } = {}) {
    if (x !== undefined) await this.moveTo(x, y)
    if (name) this.mark(name)
    const steps = Math.max(8, Math.round(duration / 16))
    let done = 0
    for (let i = 1; i <= steps; i++) {
      const target = Math.round(dy * ease(i / steps))
      const d = target - done
      if (d) await this.page.mouse.wheel(0, d)
      done = target
      this.mouse.push({ t: Date.now(), x: this.pos.x, y: this.pos.y, k: 'wheel', d })
      await sleep(16)
    }
    await this.wait(250)
  }

  /** 把元素滚到视口中 top 像素处 */
  async scrollTo(target, top, opts = {}) {
    const b = await this.box(target)
    const dy = Math.round(b.y - top)
    if (Math.abs(dy) > 4) await this.scroll(dy, opts)
  }

  /** 整段贴入（等同粘贴） */
  async paste(text, { name } = {}) {
    if (name) this.mark(name)
    await this.page.keyboard.insertText(text)
  }

  /** 在页面里记录一个元素的位置，后期用来推近和高亮 */
  async rect(name, target) {
    const b = await this.box(target)
    this.mark(`rect:${name}`, { rect: b })
    return b
  }

  async stop() {
    this.mark('end')
    await this.cdp.send('Page.stopScreencast').catch(() => {})
    await sleep(300)
    await Promise.all(this.pending)
    const out = { t0: this.t0, width: this.env.width, height: this.env.height, dsf: this.env.dsf, frames: this.frames, mouse: this.mouse, markers: this.markers }
    fs.writeFileSync(path.join(this.dir, 'take.json'), JSON.stringify(out))
    return out
  }
}

/** 直接写入应用的本机资料（IndexedDB），用来准备每一段录制的起始状态 */
export async function setState(page, state) {
  await page.goto(`${BASE}/brand/icon-32.png`)
  await page.evaluate(async (value) => {
    await new Promise((resolve, reject) => {
      const req = indexedDB.open('keyval-store')
      req.onupgradeneeded = () => req.result.createObjectStore('keyval')
      req.onsuccess = () => {
        const tx = req.result.transaction('keyval', 'readwrite')
        tx.objectStore('keyval').put(value, 'shili-workbench')
        tx.oncomplete = resolve
        tx.onerror = reject
      }
      req.onerror = reject
    })
  }, JSON.stringify({ state, version: 2 }))
}

export async function getState(page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open('keyval-store')
        req.onsuccess = () => {
          const g = req.result.transaction('keyval').objectStore('keyval').get('shili-workbench')
          g.onsuccess = () => resolve(g.result ? JSON.parse(g.result).state : null)
          g.onerror = reject
        }
        req.onerror = reject
      }),
  )
}

export { sleep }
