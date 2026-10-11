// 按附件《字节跳动_后端开发实习生_一页简历.pdf》的内容和版式重排（文字不改），用微软雅黑保证 PDF 文字层可被干净读出
import { chromium } from 'playwright-core'
import fs from 'node:fs'
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
@page { size: A4; margin: 0 }
body { margin: 0; font-family: "Microsoft YaHei", sans-serif; color: #2b2f33; font-size: 10pt; }
.page { padding: 40px 50px 30px; position: relative; height: 1123px; overflow: hidden; box-sizing: border-box }
.top { display: flex; justify-content: space-between; align-items: flex-start }
h1 { font-size: 27pt; font-weight: 400; margin: 6px 0 0; letter-spacing: 3px; color: #1f2328 }
.intent { text-align: right }
.intent .a { color: #2a6a8a; font-size: 13pt; letter-spacing: 1px }
.intent .b { color: #6b7178; font-size: 10pt; margin-top: 6px }
.meta { color: #6b7178; font-size: 10pt; line-height: 1.85; margin-top: 8px }
h2 { display: flex; align-items: center; gap: 12px; color: #2a6a8a; font-size: 13pt; font-weight: 400; margin: 10px 0 6px; letter-spacing: 1px }
h2::before { content: ''; width: 4px; height: 18px; background: #2a6a8a }
h2::after { content: ''; flex: 1; height: 1px; background: #d5dde2 }
p { margin: 0; line-height: 1.6 }
.proj { color: #2a6a8a; font-size: 11.4pt; margin: 6px 0 2px }
.stack { color: #6b7178; font-size: 10pt; line-height: 1.8 }
.foot { position: absolute; left: 50px; right: 50px; bottom: 26px; border-top: 1px solid #d5dde2; padding-top: 8px; color: #6b7178; font-size: 8pt }
</style></head><body><div class="page">
<div class="top"><h1>陈知远</h1><div class="intent"><div class="a">求职意向：后端开发实习生</div><div class="b">目标公司：字节跳动 ｜ 意向城市：北京</div></div></div>
<div class="meta">手机：138 0000 0000 | 邮箱：chen.zhiyuan@example.com<br>到岗时间：2026 年 11 月 2 日 | 每周出勤：5 天 | 可实习时长：6 个月</div>
<h2>教育背景</h2>
<p style="font-size:11.4pt">东北大学 | 本科 | 软件工程 2024.09 - 2028.06</p>
<p>相关课程：数据结构与算法、操作系统、计算机网络、数据库系统、面向对象程序设计。</p>
<p>学业表现：GPA 3.7 / 4.0，专业排名前 15%；大学英语六级 528 分，具备英文技术文档阅读能力。</p>
<h2>专业技能</h2>
<p>• 编程语言：Java 基础、集合框架、泛型与异常处理；理解 HashMap 原理，了解线程池、锁机制、JVM 内存模型与垃圾回收；了解 Go / Python。</p>
<p>• 计算机基础：掌握数组、链表、哈希表、树与常见排序；理解进程与线程、虚拟内存、I/O 多路复用，以及 TCP、HTTP / HTTPS、DNS 的基本原理。</p>
<p>• 后端框架：熟悉 Spring Boot、Spring MVC、MyBatis；理解 IoC、AOP 与事务管理；能够设计 RESTful API，完成参数校验、统一异常处理及接口文档。</p>
<p>• 数据库与中间件：熟悉 MySQL 索引、事务、隔离级别与 SQL 优化；了解 Redis 常用数据结构、缓存一致性与热点问题；了解消息队列的异步解耦、重试与幂等。</p>
<p>• 工程实践：使用 Git、Maven、Linux、Docker；能够编写单元测试，使用日志、EXPLAIN 与压测工具定位问题；具备阅读英文技术文档的能力。</p>
<h2>项目经历</h2>
<div class="proj">校园高并发活动报名系统 | 后端开发 2026.05 - 2026.09</div>
<div class="stack">技术栈：Java / Spring Boot / MySQL / Redis / RabbitMQ / Docker</div>
<p>• 业务设计：围绕活动发布、名额查询、用户报名和取消报名，拆分用户、活动与订单模块；设计核心表结构、状态流转及统一接口规范，支持分页查询与权限校验。</p>
<p>• 并发控制：通过 Redis 原子操作校验并预扣名额，结合数据库唯一索引防止重复报名；使用消息队列异步处理报名记录，并设计消费幂等、失败重试与名额补偿。</p>
<p>• 性能与可靠性：为热点活动设置缓存和随机过期时间，结合查询条件优化联合索引；针对超卖、重复请求和消息重复消费编写测试，记录吞吐量、P95 延迟及异常率。</p>
<p>• 项目成果：完成从接口设计、功能开发到容器部署的完整流程；交付接口文档、自动化测试与压测脚本，覆盖报名、取消、库存恢复等关键链路，整理并发一致性问题及解决方案。</p>
<div class="proj">短链接与访问统计平台 | 后端开发 2026.01 - 2026.04</div>
<div class="stack">技术栈：Java / Spring Boot / MySQL / Redis / Nginx</div>
<p>• 核心功能：实现长链接转换、短码跳转、有效期管理与访问统计；采用 Base62 编码生成短码，结合唯一约束和冲突重试保证标识唯一，支持链接停用与归属校验。</p>
<p>• 访问链路：利用 Redis 缓存短码映射，针对无效短码配置空值缓存与过期时间；通过异步事件记录访问数据，按日期、来源等维度聚合，减少统计逻辑对跳转耗时的影响。</p>
<p>• 工程质量：为创建、跳转、失效与权限场景补充测试；实现结构化日志和请求追踪，使用 Docker 编排运行环境，沉淀接口文档、部署步骤与故障排查记录。</p>
<h2>补充信息</h2>
<p>算法练习：完成 LeetCode 260 道题，重点覆盖二分、滑动窗口、树、图与动态规划；整理 20 篇学习笔记，主题涵盖 MySQL 索引优化、Redis 缓存策略、线程池与接口幂等。</p>
<p>个人优势：重视边界条件、接口可维护性和问题复盘；能够清晰说明技术选型依据、实现过程及验证方法。</p>
<div class="foot">虚拟示例简历：联系方式、成绩与项目经历为演示内容。</div>
</div></body></html>`
fs.writeFileSync('../assets/陈知远_简历.html', html)
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 })
await page.goto('file:///Users/lyris/Downloads/shili-demo/assets/陈知远_简历.html')
await page.pdf({ path: '../assets/陈知远_简历.pdf', format: 'A4', printBackground: true })
await page.screenshot({ path: '../assets/陈知远_简历.png' })
console.log('content', await page.evaluate(() => { const p = document.querySelector('.page'); const last = document.querySelector('.foot').previousElementSibling; return [p.scrollHeight, Math.round(last.getBoundingClientRect().bottom)] }))
await browser.close()
