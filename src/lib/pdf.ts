import * as pdfjs from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

/**
 * 提取文字型 PDF 的文字，按行还原。
 * 扫描件没有文字层，返回空字符串，由页面提示用户改为粘贴文字。
 */
export async function extractPdfText(file: File) {
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const lines: { y: number; parts: { x: number; s: string }[] }[] = []
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const [, , , , x, y] = item.transform as number[]
      let line = lines.find((l) => Math.abs(l.y - y) < 3)
      if (!line) {
        line = { y, parts: [] }
        lines.push(line)
      }
      line.parts.push({ x, s: item.str })
    }
    lines.sort((a, b) => b.y - a.y)
    // 行距明显变大时视为段落分隔，方便按经历拆分
    const out: string[] = []
    lines.forEach((l, idx) => {
      if (idx > 0 && lines[idx - 1].y - l.y > 22) out.push('')
      out.push(l.parts.sort((a, b) => a.x - b.x).map((p) => p.s).join(' ').replace(/\s{2,}/g, ' ').trim())
    })
    pages.push(out.join('\n'))
  }
  return pages.join('\n\n').trim()
}
