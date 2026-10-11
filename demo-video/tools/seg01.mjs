// 01 整理经历：拖入 PDF → DeepSeek 拆分分类 → 核对项目经历 → 保存 → 打开事实库卡片
import fs from 'node:fs'
import { launch, Take, setState, getState, BASE } from './rec.mjs'
import { EMPTY_STATE, PDF_NAME, dragOver, drop } from './common.mjs'
const DIR = '../takes/seg01'
const env = await launch()
const { page } = env
await setState(page, EMPTY_STATE)
await page.goto(`${BASE}/app/import`)
const zone = 'textarea[aria-label="简历文字"]'
await page.waitForSelector(zone)
await page.waitForTimeout(1200)
const t = new Take(env, DIR)
t.pos = { x: 1330, y: 700 }
await page.mouse.move(t.pos.x, t.pos.y)
await t.start()
await t.wait(1600)
// 拖入
const zb = await t.box(zone)
await page.evaluate((n) => window.__dragGhost(true, n), PDF_NAME)
t.mark('drag:start')
await t.moveTo(zb.x + zb.width * 0.5, zb.y + zb.height * 0.45, { duration: 1300 })
await dragOver(page, zone)
t.mark('drag:over')
await t.wait(800)
await drop(page, zone)
await page.evaluate(() => window.__dragGhost(false))
t.mark('drop')
await page.waitForFunction((s) => document.querySelector(s).value.length > 50, zone)
t.mark('text:ready')
await t.moveTo(zb.x + zb.width * 0.62, zb.y + zb.height * 0.7, { duration: 700 })
await t.wait(2600)
// 拆分
await t.click('button:has-text("拆分并分类")', { name: 'click:parse' })
await page.waitForSelector('text=核对拆分结果', { timeout: 120000 })
t.mark('review')
await t.moveTo(1050, 330, { duration: 800 })
await t.wait(2600)
// 滚到项目经历
const projId = await page.evaluate(() => [...document.querySelectorAll('article[id^="entry-"]')].find((a) => [...a.querySelectorAll('input')].some((i) => i.value.includes('活动报名')))?.id)
if (!projId) throw new Error('没找到项目卡片')
const proj = page.locator(`#${projId}`)
await t.scrollTo(proj, 205, { x: 1050, y: 420, duration: 1100, name: 'scroll:project' })
// 左侧原文也滚到项目经历那几行
const rawLine = page.locator('div.whitespace-pre-wrap', { hasText: '校园高并发活动报名系统' }).first()
await t.scrollTo(rawLine, 250, { x: 270, y: 480, duration: 1000, name: 'scroll:raw' })
await t.rect('project-card', proj)
// 指向项目卡片：左侧原文对应行高亮
const pb = await t.box(proj)
await t.moveTo(pb.x + pb.width * 0.55, pb.y + 120, { duration: 700 })
t.mark('hover:project')
await t.wait(1200)
await page.screenshot({ path: `${DIR}/check-hover.png`, scale: 'css' })
await t.wait(800)
// 逐条核对：沿着条目慢慢移动
const items = proj.locator('li.group\\/item')
const n = await items.count()
for (let i = 0; i < n; i++) {
  const b = await items.nth(i).boundingBox()
  if (!b || b.y > 760) break
  await t.moveTo(b.x + Math.min(b.width * 0.35, 260), b.y + 14, { duration: 520 })
  await t.wait(650)
}
t.mark('checked')
await t.wait(800)
await page.screenshot({ path: `${DIR}/check-review.png`, scale: 'css' })
// 保存
await t.click('button:has-text("保存到事实库")', { name: 'click:save' })
await page.waitForSelector('text=已保存到事实库')
t.mark('saved')
await t.wait(2400)
await page.screenshot({ path: `${DIR}/check-saved.png`, scale: 'css' })
await t.click('text=在事实库里查看和修改', { name: 'click:open-library' })
await page.waitForSelector('text=这段经历里的事')
t.mark('library')
await t.moveTo(900, 420, { duration: 900 })
await t.wait(3000)
await page.screenshot({ path: `${DIR}/check-library.png`, scale: 'css' })
const res = await t.stop()
fs.writeFileSync(`${DIR}/state-end.json`, JSON.stringify(await getState(page)))
fs.writeFileSync(`${DIR}/url-end.txt`, page.url())
console.log('frames', res.frames.length, 'sec', ((res.frames.at(-1).t - res.t0) / 1000).toFixed(1), page.url())
console.log(res.markers.map((m) => `${((m.t - res.t0) / 1000).toFixed(2)} ${m.name}`).join('\n'))
await env.browser.close()
