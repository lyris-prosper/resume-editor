import fs from 'node:fs'
export const EMPTY_STATE = {
  library: { profile: { name: '', headline: '', phone: '', email: '', city: '', links: [], summary: '', education: [] }, experiences: [], events: [], honors: [], skills: [] },
  eventHistory: {},
  jobs: [],
  resumes: [],
}
export const PDF_NAME = '陈知远_简历.pdf'
export const PDF_B64 = fs.readFileSync(new URL('../assets/陈知远_简历.pdf', import.meta.url)).toString('base64')

/** 拖入文件：先 dragover（页面出现拖入状态），再 drop（页面真实读取文件） */
export async function dragOver(page, selector) {
  await page.evaluate(({ b64, name, selector }) => {
    const bin = atob(b64)
    const arr = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
    const dt = new DataTransfer()
    dt.items.add(new File([arr], name, { type: 'application/pdf' }))
    window.__dt = dt
    const el = document.querySelector(selector)
    el.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true, cancelable: true }))
    el.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }))
  }, { b64: PDF_B64, name: PDF_NAME, selector })
}
export async function drop(page, selector) {
  await page.evaluate((selector) => {
    const el = document.querySelector(selector)
    el.dispatchEvent(new DragEvent('drop', { dataTransfer: window.__dt, bubbles: true, cancelable: true }))
  }, selector)
}
