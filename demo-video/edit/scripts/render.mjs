// 逐帧渲染：多个无头浏览器页面并行调用 renderAt(t) 截帧，送进 ffmpeg 编码成片段，最后拼接并混入配乐。
// 用法：node scripts/render.mjs [--from 0] [--to 90] [--workers 3] [--out build/video.mp4] [--audio build/audio/mix.wav]
//       node scripts/render.mjs --still 45.5 --out build/still.png      （单帧）
//       node scripts/render.mjs --cover --out ../output/cover.png        （封面）
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { serve } from './serve.mjs'

const require = createRequire(import.meta.url)
let chromium
try { ({ chromium } = require('playwright')) } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')) }

const EDIT = join(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d }
const has = (k) => process.argv.includes(`--${k}`)
const FPS = 30
const from = Number(arg('from', 0))
const to = Number(arg('to', 90))
const workers = Number(arg('workers', 3))
const out = resolve(EDIT, arg('out', 'build/video.mp4'))
const audio = arg('audio') ? resolve(EDIT, arg('audio')) : null

const { server, port } = await serve(0)
const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--force-color-profile=srgb', '--disable-lcd-text'] })
const open = async (query = '') => {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
  page.on('pageerror', (e) => console.error('pageerror', e.message))
  await page.goto(`http://127.0.0.1:${port}/${query}`)
  await page.evaluate(() => window.__ready)
  return page
}
const shot = (page) => page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080 } })

try {
  mkdirSync(dirname(out), { recursive: true })
  if (has('cover')) {
    const page = await open('?cover')
    writeFileSync(out, await shot(page))
    console.log('cover →', out)
  } else if (arg('stills')) {
    const page = await open()
    const dir = resolve(EDIT, arg('outdir', 'build/stills'))
    mkdirSync(dir, { recursive: true })
    for (const t of arg('stills').split(',').map(Number)) {
      await page.evaluate((x) => window.renderAt(x), t)
      writeFileSync(join(dir, `t${t.toFixed(2).padStart(5, '0')}.png`), await shot(page))
    }
    console.log('stills →', dir)
  } else if (arg('still')) {
    const page = await open(`?t=${arg('still')}`)
    writeFileSync(out, await shot(page))
    console.log('still →', out)
  } else {
    const f0 = Math.round(from * FPS)
    const f1 = Math.round(to * FPS)
    const total = f1 - f0
    const tmp = join(EDIT, 'build/chunks')
    rmSync(tmp, { recursive: true, force: true })
    mkdirSync(tmp, { recursive: true })
    const started = Date.now()
    let done = 0
    const chunk = Math.ceil(total / workers)
    const parts = []
    await Promise.all(Array.from({ length: workers }, async (_, w) => {
      const a = f0 + w * chunk
      const b = Math.min(f1, a + chunk)
      if (a >= b) return
      const file = join(tmp, `part${w}.mp4`)
      parts[w] = file
      const page = await open()
      const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
        '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-profile:v', 'high', '-g', '60', '-bf', '2',
        '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-r', String(FPS), file], { stdio: ['pipe', 'inherit', 'inherit'] })
      const closed = new Promise((r) => ff.on('close', r))
      for (let f = a; f < b; f++) {
        await page.evaluate((t) => window.renderAt(t), f / FPS)
        const buf = await shot(page)
        if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r))
        done++
        if (done % 60 === 0) {
          const el = (Date.now() - started) / 1000
          console.log(`${done}/${total} 帧 · ${el.toFixed(0)}s · 剩余约 ${((el / done) * (total - done)).toFixed(0)}s`)
        }
      }
      ff.stdin.end()
      await closed
      await page.close()
    }))
    const list = join(tmp, 'list.txt')
    writeFileSync(list, parts.filter(Boolean).map((p) => `file '${p}'`).join('\n'))
    const silent = audio ? join(tmp, 'video.mp4') : out
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent])
    if (audio) {
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', silent, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
        '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-t', String(to - from), '-movflags', '+faststart', out])
    }
    console.log(`完成 ${total} 帧，用时 ${((Date.now() - started) / 1000).toFixed(0)}s →`, out)
  }
} finally {
  await browser.close()
  server.close()
}
