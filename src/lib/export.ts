import { toCanvas } from 'html-to-image'
import { A4 } from '../templates/Paper'

/** A4 在 300dpi 下的像素宽度 */
const PNG_WIDTH = 2480

function parseRanges(range: string): [number, number][] {
  return range.split(',').map((part) => {
    const [a, b] = part.trim().replace(/u\+/i, '').split('-')
    if (a.includes('?')) return [parseInt(a.replace(/\?/g, '0'), 16), parseInt(a.replace(/\?/g, 'F'), 16)]
    return [parseInt(a, 16), parseInt(b ?? a, 16)]
  })
}

async function toDataUrl(url: string) {
  const blob = await (await fetch(url)).blob()
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * 中文字体被拆成上百个 unicode-range 子集。只内嵌纸面上真正用到的字形所在的子集，
 * 否则截图库会把所有子集都下载一遍。
 */
async function buildFontEmbedCSS(node: HTMLElement) {
  const codepoints = new Set<number>()
  for (const ch of node.textContent ?? '') codepoints.add(ch.codePointAt(0)!)
  const families = new Set(['Noto Sans SC', 'Noto Serif SC', 'Source Serif 4 Variable'])
  const rules: string[] = []

  for (const sheet of Array.from(document.styleSheets)) {
    let cssRules: CSSRuleList
    try {
      cssRules = sheet.cssRules
    } catch {
      continue
    }
    for (const rule of Array.from(cssRules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue
      const family = rule.style.getPropertyValue('font-family').replace(/['"]/g, '').trim()
      if (!families.has(family)) continue
      const range = rule.style.getPropertyValue('unicode-range')
      if (range) {
        const ranges = parseRanges(range)
        const used = [...codepoints].some((cp) => ranges.some(([a, b]) => cp >= a && cp <= b))
        if (!used) continue
      }
      const src = rule.style.getPropertyValue('src')
      const m = src.match(/url\(["']?([^"')]+\.woff2)["']?\)/)
      if (!m) continue
      const absolute = new URL(m[1], sheet.href ?? location.href).href
      const data = await toDataUrl(absolute)
      rules.push(rule.cssText.replace(src, `url(${data}) format('woff2')`))
    }
  }
  return rules.join('\n')
}

function download(href: string, filename: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
}

/** 按 A4 分页导出 PNG，多页时逐页下载 */
export async function exportPng(node: HTMLElement, basename: string) {
  await document.fonts.ready
  const fontEmbedCSS = await buildFontEmbedCSS(node)
  const ratio = PNG_WIDTH / A4.width
  const height = Math.max(A4.height, node.scrollHeight)
  const canvas = await toCanvas(node, {
    width: A4.width,
    height,
    pixelRatio: ratio,
    backgroundColor: '#ffffff',
    fontEmbedCSS,
  })
  const pages = Math.ceil(height / A4.height - 0.02)
  const pageH = Math.round(A4.height * ratio)
  for (let i = 0; i < pages; i++) {
    const page = document.createElement('canvas')
    page.width = canvas.width
    page.height = pageH
    const ctx = page.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, page.width, page.height)
    ctx.drawImage(canvas, 0, i * pageH, canvas.width, pageH, 0, 0, canvas.width, pageH)
    download(page.toDataURL('image/png'), pages > 1 ? `${basename}-第${i + 1}页.png` : `${basename}.png`)
  }
  return pages
}

/** 文字型 PDF：交给浏览器的打印引擎，文字可选择、可复制 */
export function printPdf(title: string) {
  const prev = document.title
  document.title = title
  window.print()
  document.title = prev
}

/** 文件名里去掉系统不允许的字符 */
export function safeName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '') || '简历'
}
