// 02 补充依据，再重写：AI 重写 → 修改标注 → 待补充 → 填入示例压测记录 → 再次生成 → 采纳
import fs from 'node:fs'
import { launch, Take, setState, getState, BASE } from './rec.mjs'
const DIR = '../takes/seg02'
const start = JSON.parse(fs.readFileSync('../takes/seg01/state-end.json', 'utf8'))
const exp = start.library.experiences.find((e) => e.org.includes('活动报名'))
const QPS_VALUE = '约 1500 QPS'
const P95_VALUE = '约 60 ms'
const ERR_VALUE = '低于 0.1%'
class Retry extends Error {}

async function attempt(n) {
  const env = await launch()
  const { page } = env
  try {
    await setState(page, start)
    await page.goto(`${BASE}/app/library/${exp.id}`)
    await page.waitForSelector('text=这段经历里的事')
    await page.waitForTimeout(1200)
    const t = new Take(env, DIR)
    t.pos = { x: 980, y: 300 }
    await page.mouse.move(t.pos.x, t.pos.y)
    await t.start()
    await t.wait(1800)
    const ev = page.locator('article.border-t', { has: page.locator('h3', { hasText: '性能与可靠性' }) }).first()
    await t.scrollTo(ev, 92, { x: 980, y: 420, duration: 1300, name: 'scroll:event' })
    await t.rect('event', ev)
    const para = ev.locator('div.border-l-2 > p').first()
    await t.hover(para, { fx: 0.4, dwell: 1600 })
    t.mark('original')
    await t.click(ev.locator('button:has-text("AI 重写")').first(), { name: 'click:rewrite1' })
    await ev.locator('text=招聘方第一眼').waitFor({ timeout: 120000 })
    t.mark('review1')
    const labels = await ev.locator('input[id^="q-"]').evaluateAll((els) => els.map((e) => e.id.slice(2)))
    const qps = labels.find((l) => /QPS|吞吐/i.test(l))
    const p95 = labels.find((l) => /P95/i.test(l))
    console.log(`#${n} labels`, labels)
    const err = labels.find((l) => /异常率|错误率|失败率/.test(l))
    const ok = qps && p95 && (labels.length === 2 || (labels.length === 3 && err))
    if (!ok) throw new Retry('labels ' + labels.join(','))
    t.mark('labels', { labels, values: { [qps]: QPS_VALUE, [p95]: P95_VALUE, ...(err ? { [err]: ERR_VALUE } : {}) } })
    fs.writeFileSync(`${DIR}/review1.txt`, await ev.locator('div.animate-fade').first().innerText())
    // 原文与改写对照
    const card = ev.locator('div.animate-fade').first()
    await t.scrollTo(ev.locator('text=简历表达').first(), 80, { x: 980, y: 400, duration: 1000, name: 'scroll:diff' })
    await t.rect('card', card)
    await t.moveTo(1240, 330, { duration: 600 })
    await t.wait(1600)
    // 指向一处修改：出现选区把手和“采纳 / 保留原文”菜单
    const hunk = card.locator('[data-hunk]').filter({ has: page.locator('ins') }).first()
    const hb = await hunk.boundingBox()
    await t.moveTo(hb.x + Math.min(hb.width * 0.5, 120), hb.y + 10, { duration: 700 })
    t.mark('hover:hunk')
    await t.wait(1800)
    await t.moveTo(1290, hb.y + 40, { duration: 600 })
    await t.wait(1400)
    await page.screenshot({ path: `${DIR}/check-review1.png`, scale: 'css' })
    // 聚焦待补充
    const q = card.locator('div.bg-alert-wash\\/70').first()
    await t.scrollTo(q, 250, { x: 1290, y: 450, duration: 1000, name: 'scroll:quantify' })
    await t.rect('quantify', q)
    await t.wait(2200)
    t.mark('record-card')
    await t.wait(2600)
    await page.screenshot({ path: `${DIR}/check-quantify.png`, scale: 'css' })
    // 输入示例压测记录
    await t.click(`[id="q-${qps}"]`, { name: 'click:qps', dwell: 300 })
    await t.type(QPS_VALUE, { delay: 85, name: 'type:qps' })
    await t.wait(400)
    await t.click(`[id="q-${p95}"]`, { name: 'click:p95', dwell: 300 })
    await t.type(P95_VALUE, { delay: 85, name: 'type:p95' })
    if (err) {
      await t.wait(400)
      await t.click(`[id="q-${err}"]`, { name: 'click:err', dwell: 300 })
      await t.type(ERR_VALUE, { delay: 85, name: 'type:err' })
    }
    await t.wait(1200)
    await page.screenshot({ path: `${DIR}/check-filled.png`, scale: 'css' })
    // 再次生成
    await t.click(card.locator('button:has-text("用这些数字再写一版")'), { name: 'click:rewrite2' })
    await page.waitForFunction(() => !document.querySelector('input[id^="q-"]') && !document.querySelector('button:disabled .animate-spin'), null, { timeout: 120000 })
    await ev.locator('text=招聘方第一眼').waitFor({ timeout: 120000 })
    t.mark('review2')
    const r2 = await card.innerText()
    fs.writeFileSync(`${DIR}/review2.txt`, r2)
    const leadText = await card.locator('div.relative').nth(1).innerText().catch(() => '')
    console.log(`#${n} review2:\n${r2.slice(0, 400)}`)
    if (!r2.includes('1500') || !r2.includes('60') || r2.includes('补：') || /补上数字/.test(r2) || /\d+\s*%/.test(r2.split('体现了')[0].replace(/0\.1\s*%/g, ''))) throw new Retry('result2')
    await t.scrollTo(ev.locator('text=简历表达').first(), 80, { x: 1290, y: 400, duration: 900, name: 'scroll:diff2' })
    await t.rect('card2', card)
    await t.wait(3800)
    await page.screenshot({ path: `${DIR}/check-review2.png`, scale: 'css' })
    // 补充的数字已记进事实
    await t.scrollTo(ev.locator('h3').first(), 92, { x: 1290, y: 400, duration: 900, name: 'scroll:facts' })
    await t.rect('facts', ev.locator('dl').first())
    await t.wait(2800)
    await page.screenshot({ path: `${DIR}/check-facts.png`, scale: 'css' })
    // 采纳
    const accept = card.locator('button:has-text("全部采纳")')
    await t.scrollTo(accept, 600, { x: 1290, y: 400, duration: 900 })
    await t.click(accept, { name: 'click:accept' })
    await ev.locator('text=已更新').waitFor()
    await t.scrollTo(ev.locator('h3').first(), 92, { x: 1290, y: 400, duration: 900, name: 'scroll:final' })
    await t.moveTo(1300, 520, { duration: 600 })
    t.mark('final')
    await t.rect('final', ev)
    await t.wait(4200)
    await page.screenshot({ path: `${DIR}/check-final.png`, scale: 'css' })
    const res = await t.stop()
    fs.writeFileSync(`${DIR}/state-end.json`, JSON.stringify(await getState(page)))
    console.log('frames', res.frames.length, 'sec', ((res.frames.at(-1).t - res.t0) / 1000).toFixed(1))
    console.log(res.markers.map((m) => `${((m.t - res.t0) / 1000).toFixed(2)} ${m.name}`).join('\n'))
    return true
  } finally {
    await env.browser.close()
  }
}

for (let n = 1; n <= 8; n++) {
  try {
    if (await attempt(n)) break
  } catch (e) {
    if (e instanceof Retry) console.log(`#${n} retry: ${e.message}`)
    else throw e
  }
}
