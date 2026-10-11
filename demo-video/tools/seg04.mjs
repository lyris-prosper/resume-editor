// 04 编辑并存回：改一句概括 → 右侧预览更新 → 存回事实库 → 存为新写法 → 导出图片 → 事实库里多了一种写法
import fs from 'node:fs'
import { launch, Take, setState, getState, BASE } from './rec.mjs'
const DIR = '../takes/seg04'
const start = JSON.parse(fs.readFileSync('../takes/seg03/state-end.json', 'utf8'))
const resume = start.resumes[0]
const NEW_LEAD = '报名链路性能与稳定性'
const env = await launch()
const { page } = env
await setState(page, start)
await page.goto(`${BASE}/app/resumes/${resume.id}`)
await page.waitForSelector('text=导出图片')
await page.waitForTimeout(1500)
const t = new Take(env, DIR)
t.pos = { x: 1000, y: 420 }
await page.mouse.move(t.pos.x, t.pos.y)
await t.start()
await t.wait(2600)
await page.screenshot({ path: `${DIR}/check-studio.png`, scale: 'css' })
const edId = await page.evaluate(() => [...document.querySelectorAll('div[id^="ed-rb_"]')].find((d) => d.querySelector('textarea')?.value.includes('1500'))?.id)
const ed = page.locator(`#${edId}`)
await t.scrollTo(ed, 250, { x: 230, y: 450, duration: 1200, name: 'scroll:bullet' })
await t.rect('bullet-editor', ed)
const lead = ed.locator('input[aria-label="概括短语"]')
await t.click(lead, { fx: 0.9, name: 'click:lead' })
await page.keyboard.press('Meta+A')
t.mark('select:lead')
await t.wait(500)
await t.type(NEW_LEAD, { delay: 110, name: 'type:lead' })
await t.wait(600)
// 看右侧预览
const pb = await page.locator('.paper-shadow').first().boundingBox()
const hit = await page.evaluate((txt) => {
  const el = [...document.querySelectorAll('.paper-shadow *')].find((n) => n.childElementCount === 0 && n.textContent.includes(txt))
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.x, y: r.y, width: r.width, height: r.height }
}, NEW_LEAD)
console.log('preview hit', hit)
if (hit) { t.mark('rect:preview-bullet', { rect: hit }); await t.moveTo(hit.x + hit.width + 60, hit.y + hit.height + 26, { duration: 900 }) }
t.mark('preview-updated')
await t.wait(2600)
await page.screenshot({ path: `${DIR}/check-edited.png`, scale: 'css' })
// 存回事实库
await t.click(ed.locator('button:has-text("存回事实库")'), { name: 'click:writeback' })
await page.waitForSelector('[role="dialog"]')
t.mark('dialog')
await t.rect('dialog', page.locator('[role="dialog"]'))
await t.moveTo(900, 470, { duration: 800 })
await t.wait(3200)
await page.screenshot({ path: `${DIR}/check-dialog.png`, scale: 'css' })
await t.click('button:has-text("存为新写法")', { name: 'click:save-variant' })
await page.waitForSelector('[role="dialog"]', { state: 'detached' })
t.mark('saved-variant')
await t.rect('bullet-editor-after', ed)
await t.hover(ed.locator('select[aria-label="切换写法"]'), { dwell: 0 })
await t.wait(2600)
await page.screenshot({ path: `${DIR}/check-after.png`, scale: 'css' })
// 细节：调大行距，让内容正好铺满一页
await t.click('button:has-text("细节")', { name: 'click:style' })
const lh = page.locator('input[type="range"]').nth(1)
await lh.waitFor()
const rb = await lh.boundingBox()
await t.rect('style-menu', page.locator('div.pop').last())
const fx = (v) => rb.x + 8 + (rb.width - 16) * ((v - 1.35) / 0.45)
await t.moveTo(fx(1.55), rb.y + rb.height / 2, { duration: 700 })
await t.wait(400)
await page.mouse.down()
t.mark('drag:lineheight')
await t.moveTo(fx(1.7), rb.y + rb.height / 2, { duration: 900 })
await page.mouse.up()
for (let i = 0; i < 6; i++) {
  const v = Number(await lh.inputValue())
  if (Math.abs(v - 1.7) < 0.01) break
  await page.keyboard.press(v < 1.7 ? 'ArrowRight' : 'ArrowLeft')
  await t.wait(200)
}
await t.wait(500)
for (let i = 0; i < 3 && (await page.locator('text=/共 \\d+ 页/').count()); i++) {
  await page.keyboard.press('ArrowLeft')
  await t.wait(500)
}
console.log('line height', await lh.inputValue(), 'pages>1?', await page.locator('text=/共 \\d+ 页/').count())
t.mark('lineheight:set')
await t.wait(1600)
await page.keyboard.press('Escape')
await t.clickAt(1330, 240, { dwell: 200, name: 'click:close-style' })
await t.wait(1600)
await page.screenshot({ path: `${DIR}/check-style.png`, scale: 'css' })
// 导出图片（真实导出）
const dl = page.waitForEvent('download', { timeout: 60000 })
await t.click('button:has-text("导出图片")', { name: 'click:export' })
const file = await dl
await file.saveAs(`${DIR}/export.png`)
t.mark('exported')
await t.wait(2400)
// 整页简历
await t.scroll(560, { x: 1000, y: 500, duration: 1600, name: 'scroll:paper' })
await t.wait(2400)
await t.scroll(-560, { duration: 1200 })
await t.wait(800)
// 回到事实库：这件事多了一种写法
await t.click('nav[aria-label="工作台"] >> text=事实库', { name: 'click:library-tab' })
await page.waitForSelector('text=这段经历里的事')
const ev = page.locator('article.border-t', { has: page.locator('h3', { hasText: '性能与可靠性' }) }).first()
await t.wait(800)
await t.scrollTo(ev.locator('text=简历表达').first(), 300, { x: 980, y: 450, duration: 1300, name: 'scroll:variants' })
await t.rect('variants', ev)
const tab = ev.locator('[role="tab"]', { hasText: '改' }).first()
await t.click(tab, { name: 'click:new-variant-tab' })
t.mark('library-variants')
await t.wait(3200)
await page.screenshot({ path: `${DIR}/check-library.png`, scale: 'css' })
const res = await t.stop()
fs.writeFileSync(`${DIR}/state-end.json`, JSON.stringify(await getState(page)))
console.log('frames', res.frames.length, 'sec', ((res.frames.at(-1).t - res.t0) / 1000).toFixed(1))
console.log(res.markers.map((m) => `${((m.t - res.t0) / 1000).toFixed(2)} ${m.name}`).join('\n'))
await env.browser.close()
