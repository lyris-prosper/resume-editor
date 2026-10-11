import { describe, expect, it } from 'vitest'
import { seedLibrary } from '../../data/seed'
import { SAMPLE_JOB } from '../../data/sampleJob'
import { SAMPLE_RESUME } from '../../data/sampleResume'
import { assembleResume, eventLine, sourceItems, validatePicks } from '../assemble'
import { unsupportedNumbers } from '../facts'
import { byTimeDesc, experienceHeading } from '../format'
import { matchRequirements, recommendPicks } from '../match'
import { classifyEntry, headingHint, suggestCategory } from '../classify'
import { compose, diffSegments, hunks } from '../diff'
import { parseJobText, parseResumeText } from '../ai/mock'
import { guard, jobKeywords, rewriteLocally } from '../ai/rewrite'
import { JobTarget, Library, Resume } from '../schema'
import { migrateV1 } from '../../store/migrate'

const lib = Library.parse(seedLibrary)
const NUM = /\d+(?:\.\d+)?%?/g

describe('事实约束', () => {
  it('没有记录的数字会被标出来', () => {
    const ev = lib.events.find((e) => e.id === 'ev_xingye_data')!
    expect(unsupportedNumbers('清理报名表，分析效率提升 40%', ev)).toEqual(['40%'])
    const interview = lib.events.find((e) => e.id === 'ev_xingye_interview')!
    expect(unsupportedNumbers('整理 12 位同学访谈，归纳 3 类问题', interview)).toEqual([])
  })

  it('选材只能指向存在的事件和表达', () => {
    const problems = validatePicks(lib, [
      { eventId: 'ev_missing', variantId: 'x' },
      { eventId: 'ev_xingye_data', variantId: 'va_nope' },
      { eventId: 'ev_media_welcome', variantId: 'va_media_welcome' },
    ])
    expect(problems.map((p) => p.eventId)).toEqual(['ev_missing', 'ev_xingye_data'])
  })

  it('同一事件不能在一份简历里出现两种表达', () => {
    const problems = validatePicks(lib, [
      { eventId: 'ev_xingye_interview', variantId: 'va_interview_product' },
      { eventId: 'ev_xingye_interview', variantId: 'va_interview_research' },
    ])
    expect(problems).toHaveLength(1)
  })

  it('没有表达的事件由事实拼出一句话', () => {
    const ev = lib.events.find((e) => e.id === 'ev_lab_review')!
    expect(eventLine(ev).text).toContain('检索并阅读 40 篇相关文献')
  })
})

describe('组装简历', () => {
  it('生成的快照通过 schema 校验，并按栏目分节', () => {
    const r = assembleResume({
      library: lib,
      picks: [
        { eventId: 'ev_xingye_interview', variantId: 'va_interview_research' },
        { eventId: 'ev_nanfeng_proto', variantId: 'va_nanfeng_proto_product' },
        { eventId: 'ev_lab_survey' },
      ],
      template: 'dense',
    })
    expect(() => Resume.parse(r)).not.toThrow()
    expect(sourceItems(r)).toEqual(['ev_xingye_interview', 'ev_lab_survey', 'ev_nanfeng_proto'])
    expect(r.sections.map((s) => s.kind)).toEqual(['education', 'internship', 'research', 'project', 'honor', 'skill'])
    const intern = r.sections.find((s) => s.kind === 'internship')!
    expect(intern.items[0]).toMatchObject({ heading: '星野科技', subheading: '产品实习生' })
    expect(r.style.accent).toBe('#1768e5')
  })

  it('快照复制文字，事实库之后改动不影响旧简历', () => {
    const copy = structuredClone(lib)
    const r = assembleResume({ library: copy, picks: [{ eventId: 'ev_xingye_data', variantId: 'va_data_analysis' }], template: 'classic' })
    copy.events.find((e) => e.id === 'ev_xingye_data')!.variants[0].text = '改过了'
    expect(r.sections.find((s) => s.kind === 'internship')!.items[0].bullets[0].text).not.toBe('改过了')
  })
})

describe('格式规则', () => {
  it('全职和栏目本身的性质不标注，其他性质明确标注', () => {
    expect(experienceHeading({ org: '甲公司', role: '运营', employmentType: 'full-time', kind: 'work' })).toBe('甲公司 - 运营')
    expect(experienceHeading({ org: '乙公司', role: '运营', employmentType: 'internship', kind: 'internship' })).toBe('乙公司 - 运营')
    expect(experienceHeading({ org: '丙公司', role: '运营', employmentType: 'part-time', kind: 'work' })).toBe('丙公司 - 运营（兼职）')
    expect(experienceHeading({ org: '丁项目', role: '负责人', employmentType: 'personal', kind: 'project' })).toBe('丁项目 - 负责人（个人项目）')
  })

  it('时间倒序：进行中优先，无日期置底', () => {
    const items = [
      { id: 'a', start: '2024.01', end: '2024.06' },
      { id: 'b', start: '', end: '' },
      { id: 'c', start: '2025.03', end: '至今' },
      { id: 'd', start: '2024.03', end: '2024.06' },
    ]
    expect(byTimeDesc(items, (x) => x).map((x) => x.id)).toEqual(['c', 'd', 'a', 'b'])
  })
})

describe('经历分类', () => {
  it('识别常见的章节标题', () => {
    expect(headingHint('教育背景')).toBe('education')
    expect(headingHint('【实习经历】')).toBe('internship')
    expect(headingHint('科研经历：')).toBe('research')
    expect(headingHint('项目经验')).toBe('project')
    expect(headingHint('校园经历')).toBe('campus')
    expect(headingHint('获奖情况')).toBe('honor')
    expect(headingHint('专业技能')).toBe('skill')
    expect(headingHint('负责门店销售数据的清洗')).toBeNull()
  })

  it('没有标题时按内容判断，不全归为工作经历', () => {
    expect(classifyEntry('中国医科大学 药学 2024.09-2028.06\n本科').category).toBe('education')
    expect(classifyEntry('辉瑞制药有限公司 医学信息实习生 2025.06-2025.08').category).toBe('internship')
    expect(classifyEntry('基于 AI 的药物分子设计模型 2025.09-2026.01\n在课题组导师指导下复现论文模型').category).toBe('research')
    expect(classifyEntry('校学生会新媒体中心 内容编辑 2024.09-2025.06').category).toBe('campus')
    expect(classifyEntry('“挑战杯”创业计划竞赛 队长').category).toBe('project')
  })

  it('“工作经历”标题下的实习按实习归类', () => {
    expect(classifyEntry('星野科技 产品实习生', 'work').category).toBe('internship')
    expect(classifyEntry('校学生会新媒体中心 内容编辑', 'work').category).toBe('campus')
    expect(classifyEntry('甲科技 后端开发', 'work').category).toBe('work')
  })

  it('已入库的经历分错时给出建议', () => {
    const wrong = { kind: 'internship' as const, org: '中国医科大学', role: '药学 本科', rawText: '', summary: '' }
    expect(suggestCategory(wrong)?.category).toBe('education')
    const school = { kind: 'internship' as const, org: '虚构示例大学', role: '信息管理与信息系统', rawText: '本科 主修课程：数据库原理', summary: '' }
    expect(suggestCategory(school)?.category).toBe('education')
    const right = { kind: 'internship' as const, org: '星野科技', role: '产品实习生', rawText: '', summary: '' }
    expect(suggestCategory(right)).toBeNull()
  })

  it('旧简历拆成教育和各类经历', () => {
    const r = parseResumeText(SAMPLE_RESUME)
    expect(r.contacts).toMatchObject({ name: '周晓禾', email: 'xiaohe@example.com' })
    const edu = r.entries.find((e) => e.category === 'education')!
    expect(edu).toMatchObject({ org: '虚构示例理工大学', degree: '本科', start: '2022.09' })
    expect(r.entries.filter((e) => e.category !== 'education').map((e) => [e.org, e.category])).toEqual([
      ['虚构示例丙咨询', 'internship'],
      ['统计学院学生会', 'campus'],
    ])
    expect(r.entries.flatMap((e) => e.items)).toHaveLength(4)
  })

  it('解析荣誉、技能和没有空行分隔的章节', () => {
    const r = parseResumeText(
      ['李同学', '教育经历', '甲大学 计算机 硕士 2024.09-2027.06', '科研经历', '图学习实验室 研究助理 2025.01-至今', '- 复现 2 篇论文的模型', '获奖情况', '国家奖学金 2025.10', '专业技能', '编程：Python、PyTorch'].join('\n'),
    )
    expect(r.entries.map((e) => e.category)).toEqual(['education', 'research'])
    expect(r.entries[1]).toMatchObject({ org: '图学习实验室', role: '研究助理' })
    const p = parseResumeText('项目经历\n基于 AI 的药物分子设计模型 2025.09-2026.01\n- 复现分子生成模型')
    expect(p.entries[0]).toMatchObject({ org: '基于 AI 的药物分子设计模型', role: '' })
    expect(r.honors[0]).toMatchObject({ title: '国家奖学金', date: '2025.10' })
    expect(r.skills[0]).toMatchObject({ label: '编程', items: ['Python', 'PyTorch'] })
  })
})

describe('修改标注', () => {
  it('拆出删去和新写的片段，采纳与保留都能还原', () => {
    const a = '对 312 份问卷数据进行了清洗，然后用 SPSS 做了一些描述统计。'
    const b = '清洗 312 份问卷数据，用 SPSS 做描述统计与交叉分析。'
    const segs = diffSegments(a, b)
    expect(hunks(segs).length).toBeGreaterThan(0)
    expect(compose(segs, {}, 'accept')).toBe(b)
    expect(compose(segs, {}, 'reject')).toBe(a)
    // 只保留第一处修改
    const first = hunks(segs)[0].id
    const mixed = compose(segs, { [first]: 'reject' }, 'accept')
    expect(mixed).not.toBe(a)
    expect(mixed).not.toBe(b)
  })

  it('挪了位置的词并成一处修改，避免单独采纳后读不通', () => {
    const segs = diffSegments('对 312 份问卷数据进行了清洗，然后用 SPSS', '清洗 312 份问卷数据，剔除无效样本，用 SPSS')
    expect(hunks(segs)).toHaveLength(1)
  })

  it('没有变化时没有修改', () => {
    expect(hunks(diffSegments('一样的话', '一样的话'))).toEqual([])
  })
})

describe('AI 重写（本地规则）', () => {
  const survey = lib.events.find((e) => e.id === 'ev_lab_survey')!

  it('去口语、补回事实里漏写的内容，并说明体现的能力', () => {
    const v = survey.variants[0]
    const r = rewriteLocally({ lead: v.lead, text: v.text, facts: survey })
    expect(r.text).not.toContain('进行了')
    expect(r.text).not.toContain('一些')
    expect(r.text).toContain('剔除无效样本')
    expect(r.insights.map((i) => i.label)).toContain('数据分析')
  })

  it('换了说法但意思已经写进去的事实，不会重复补', () => {
    const ev = lib.events.find((e) => e.id === 'ev_nanfeng_research')!
    const r = rewriteLocally({ lead: ev.variants[0].lead, text: ev.variants[0].text, facts: ev })
    expect(r.text).not.toContain('设计并发放问卷')
    const interview = lib.events.find((e) => e.id === 'ev_xingye_interview')!
    expect(rewriteLocally({ lead: interview.variants[0].lead, text: interview.variants[0].text, facts: interview }).text).toContain('按问题主题归类')
  })

  it('任何改写都不会出现事实里没有的数字', () => {
    for (const ev of lib.events) {
      const v = ev.variants[0]
      const job = parseJobText(SAMPLE_JOB)
      for (const focus of [undefined, { title: job.title, company: job.company, keywords: jobKeywords(SAMPLE_JOB), requirements: job.requirements.map((x) => x.text) }]) {
        const r = rewriteLocally({ lead: v?.lead ?? '', text: v?.text ?? '', facts: ev, job: focus })
        const sources = [v?.text ?? '', v?.lead ?? '', ev.action, ev.result, ev.background, ...ev.metrics]
        expect(guard(`${r.lead} ${r.text}`, sources)).toEqual([])
        for (const n of r.text.match(NUM) ?? []) expect(sources.join(' ')).toContain(n)
      }
    }
  })

  it('按岗位调整时不会先补一句再删掉同一句', () => {
    const job = parseJobText(SAMPLE_JOB)
    const focus = { title: job.title, company: job.company, keywords: jobKeywords(SAMPLE_JOB), requirements: job.requirements.map((x) => x.text) }
    const r = rewriteLocally({ lead: survey.variants[0].lead, text: survey.variants[0].text, facts: survey, job: focus })
    const added = r.notes.filter((n) => n.startsWith('补上')).map((n) => n.match(/「(.+)」/)?.[1])
    const removed = r.notes.filter((n) => n.startsWith('删去和')).map((n) => n.match(/的「(.+)」$/)?.[1])
    expect(added.filter((a) => removed.includes(a))).toEqual([])
  })

  it('按岗位调整时概括短语换成岗位里的说法；已经用了岗位说法的保持不变', () => {
    const ev = lib.events.find((e) => e.id === 'ev_xingye_interview')!
    const job = parseJobText(SAMPLE_JOB)
    const focus = { title: job.title, company: job.company, keywords: jobKeywords(SAMPLE_JOB), requirements: job.requirements.map((x) => x.text) }
    expect(rewriteLocally({ lead: ev.variants[0].lead, text: ev.variants[0].text, facts: ev, job: focus }).lead).toBe(ev.variants[0].lead)
    const r = rewriteLocally({
      lead: '记录整理',
      text: ev.variants[0].text,
      facts: ev,
      job: { title: job.title, company: job.company, keywords: jobKeywords(SAMPLE_JOB), requirements: job.requirements.map((x) => x.text) },
    })
    expect(r.lead).toBe('用户研究')
  })
})

describe('岗位识别与匹配', () => {
  it('识别示例 JD 的公司、职位和各类要求', () => {
    const job = parseJobText(SAMPLE_JOB)
    expect(job.company).toBe('虚构示例乙科技有限公司')
    expect(job.title).toBe('产品运营实习生')
    expect(job.location).toBe('上海')
    expect(job.requirements.filter((r) => r.kind === 'duty')).toHaveLength(4)
    expect(job.requirements.find((r) => r.text.includes('每周到岗'))?.kind).toBe('hard')
    expect(job.requirements.filter((r) => r.kind === 'bonus')).toHaveLength(2)
  })

  it('认不出公司时留空，不去猜', () => {
    expect(parseJobText('岗位职责：\n1. 整理数据').company).toBe('')
  })

  it('用户研究要求能找到访谈事件，门槛条件不参与匹配', () => {
    const job = parseJobText(SAMPLE_JOB)
    const reqs = job.requirements.map((r, i) => ({ ...r, id: `r${i}` }))
    const matches = matchRequirements(lib, reqs)
    const research = matches.find((m) => m.requirement.text.includes('用户研究'))!
    expect(research.candidates.map((c) => c.event.id)).toContain('ev_xingye_interview')
    expect(matches.find((m) => m.requirement.kind === 'hard')!.candidates).toEqual([])
    const picks = recommendPicks(matches, SAMPLE_JOB)
    expect(picks.length).toBeGreaterThan(0)
    expect(validatePicks(lib, picks)).toEqual([])
  })
})

describe('旧数据迁移', () => {
  it('v1 的“工作 / 项目”两类拆到新栏目，确认状态去掉，其他内容保留', () => {
    const v1 = {
      library: {
        profile: { name: '甲', phone: '', email: '', city: '', links: [], summary: '', education: [{ id: 'e1', school: '乙大学', degree: '本科', major: '药学', start: '2024.09', end: '2028.06', details: '', status: 'draft' }] },
        experiences: [
          { id: 'x1', kind: 'work', org: '辉瑞', role: '实习生', employmentType: 'internship', start: '', end: '', summary: '', status: 'confirmed', rawText: '', version: 1, updatedAt: 0 },
          { id: 'x2', kind: 'work', org: '学生会', role: '干事', employmentType: 'campus', start: '', end: '', summary: '', status: 'draft', rawText: '', version: 1, updatedAt: 0 },
          { id: 'x3', kind: 'project', org: '课题', role: '', employmentType: 'research', start: '', end: '', summary: '', status: 'draft', rawText: '', version: 1, updatedAt: 0 },
          { id: 'x4', kind: 'work', org: '丙公司', role: '运营', employmentType: 'full-time', start: '', end: '', summary: '', status: 'draft', rawText: '', version: 1, updatedAt: 0 },
        ],
        events: [{ id: 'v1', experienceId: 'x1', title: 't', background: '', action: 'a', result: '', metrics: [], signals: [], contribution: '', status: 'draft', evidence: 'self', sourceNote: '', variants: [{ id: 'va', angle: '原文', lead: '', text: 'a', origin: 'import', status: 'draft', createdAt: 0 }], version: 1, updatedAt: 0 }],
        honors: [{ id: 'h', title: '奖', date: '', issuer: '', status: 'draft' }],
        skills: [],
      },
      jobs: [{ id: 'j', company: '', title: '', location: '', raw: '', responsibilities: [], requirements: [], createdAt: 0 }],
      resumes: [],
    }
    const s = migrateV1(structuredClone(v1))
    expect(s.library.experiences.map((e: { kind: string }) => e.kind)).toEqual(['internship', 'campus', 'research', 'work'])
    expect(() => Library.parse(s.library)).not.toThrow()
    expect(JSON.stringify(s.library)).not.toContain('"status"')
    expect(s.library.profile.education[0].school).toBe('乙大学')
    expect(() => JobTarget.parse(s.jobs[0])).not.toThrow()
  })
})
