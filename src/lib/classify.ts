import { KIND_LABEL, KIND_TYPES, type Category, type EmploymentType, type ExperienceKind } from './schema'

/** 简历里常见的章节标题；导入时先看标题，再看内容 */
export type SectionHint = Category | 'honor' | 'skill' | 'summary' | 'contact'

const HEADINGS: [SectionHint, RegExp][] = [
  ['education', /^(教育(背景|经历|信息)?|学历(背景|信息)?|education)$/i],
  ['internship', /^(实习(经历|经验)?|internships?)$/i],
  ['research', /^(科研(经历|项目|经验)?|研究(经历|经验|项目)|学术(经历|成果)|论文(发表)?|publications?|research(\s+experience)?)$/i],
  ['project', /^(项目(经历|经验)?|个人项目|课程项目|竞赛(经历)?|projects?)$/i],
  ['campus', /^(校园(经历|活动)|社团(经历|活动)?|学生工作|课外(活动|经历)|社会实践|志愿(者)?(经历|服务)?|activities)$/i],
  ['work', /^(工作(经历|经验)|职业经历|任职经历|全职经历|experience|work(\s+experience)?)$/i],
  ['honor', /^(荣誉(奖项|证书)?|获奖(情况|经历)?|奖项|奖学金|证书|honou?rs?|awards?)$/i],
  ['skill', /^((专业|个人)?技能(特长)?|技术栈|能力|skills?)$/i],
  ['summary', /^(自我评价|个人(总结|简介|评价|优势)|关于我|summary|profile)$/i],
  ['contact', /^(联系方式|基本信息|个人信息)$/i],
]

/** 一行字是不是章节标题；不是时返回 null */
export function headingHint(line: string): SectionHint | null {
  const t = line
    .replace(/^[#\s【\[]+|[】\]\s:：]+$/g, '')
    .replace(/[\s|｜]/g, '')
    .trim()
  if (!t || t.length > 12) return null
  for (const [hint, re] of HEADINGS) if (re.test(t)) return hint
  return null
}

const SCHOOL = /(大学|学院|学校|中学|university|college|school)/i
const DEGREE = /(本科|学士|硕士|研究生|博士|专科|大专|bachelor|master|ph\.?d)/i

interface Rule {
  kind: ExperienceKind
  type: EmploymentType
  re: RegExp
  why: string
  /** 弱线索：只在没有更明确的信息时使用 */
  weak?: boolean
}

/** 内容里的线索，按优先级排列：越具体越靠前 */
const RULES: Rule[] = [
  { kind: 'research', type: 'research', re: /(实验室|课题组|课题|科研|研究助理|论文|发表|期刊|会议论文|SCI|EI|国自然|大创|导师)/i, why: '提到课题、实验室或论文' },
  { kind: 'internship', type: 'internship', re: /(实习)/, why: '职位里有“实习”' },
  { kind: 'project', type: 'competition', re: /(竞赛|比赛|大赛|挑战杯|黑客松|hackathon)/i, why: '是一项竞赛' },
  { kind: 'project', type: 'course', re: /(课程|大作业|课设|毕业设计|毕设)/, why: '是课程或毕业设计' },
  { kind: 'project', type: 'personal', re: /(个人项目|开源|side project|独立开发)/i, why: '是个人或开源项目' },
  { kind: 'campus', type: 'volunteer', re: /(志愿|支教)/, why: '是志愿服务' },
  { kind: 'campus', type: 'campus', re: /(学生会|社团|协会|团委|班长|班委|学生会|俱乐部|部长|干事|社长|校队)/, why: '是学生组织' },
  { kind: 'work', type: 'part-time', re: /(兼职)/, why: '是兼职' },
  { kind: 'project', type: 'personal', re: /(项目|平台|小程序|app|模型|系统设计|系统开发)$/i, why: '名称是一个项目', weak: true },
]

export interface Classification {
  category: Category
  type: EmploymentType
  reason: string
}

/** 根据经历本身的文字判断栏目；hint 是它所在章节的标题 */
export function classifyEntry(text: string, hint?: SectionHint | null, headLine = ''): Classification {
  const head = headLine || text.split('\n')[0]
  const edu = (reason: string): Classification => ({ category: 'education', type: 'full-time', reason })
  if (hint === 'education') return edu('在“教育背景”标题下')
  const headRule = RULES.find((r) => r.re.test(head))
  const strongHead = headRule && !headRule.weak ? headRule : undefined
  if (SCHOOL.test(head) && !strongHead && (DEGREE.test(text) || /(专业|主修|GPA|绩点|排名)/i.test(text))) return edu('包含学校和学历')

  if (hint && hint in KIND_LABEL) {
    const kind = hint as ExperienceKind
    // 很多同学把实习、科研写在“工作经历”下，内容线索更可靠
    if (kind === 'work') {
      const strong =
        RULES.find((r) => (r.kind === 'internship' || r.kind === 'research') && r.re.test(text)) ?? (strongHead && strongHead.kind !== 'work' ? strongHead : undefined)
      if (strong) return { category: strong.kind, type: strong.type, reason: `${strong.why}（原在“工作经历”标题下）` }
    }
    const refined = RULES.find((r) => r.kind === kind && r.re.test(text))
    return { category: kind, type: refined?.type ?? KIND_TYPES[kind][0], reason: `在“${KIND_LABEL[kind]}”标题下` }
  }

  // 标题行优先：机构和职位最能说明性质
  if (strongHead) return { category: strongHead.kind, type: strongHead.type, reason: strongHead.why }
  if (SCHOOL.test(head)) return edu('机构是一所学校')
  if (headRule) return { category: headRule.kind, type: headRule.type, reason: headRule.why }
  const bodyRule = RULES.find((r) => r.re.test(text))
  if (bodyRule) return { category: bodyRule.kind, type: bodyRule.type, reason: bodyRule.why }
  if (/(有限公司|集团|科技|公司|银行|研究院|事务所|工作室|inc|ltd|co\.)/i.test(head)) {
    return { category: 'work', type: 'full-time', reason: '机构是一家公司' }
  }
  return { category: 'work', type: 'full-time', reason: '没有明确线索，先放在工作经历' }
}

/** 已入库的经历：如果内容明显属于另一个栏目，给出建议；否则返回 null */
export function suggestCategory(exp: { kind: ExperienceKind; org: string; role: string; rawText: string; summary: string }, eventText = '') {
  const head = `${exp.org} ${exp.role}`
  const c = classifyEntry([head, exp.summary, exp.rawText, eventText].join('\n'), null, head)
  if (c.category === exp.kind || c.reason.startsWith('没有明确线索') || c.reason === '机构是一家公司') return null
  return c
}
