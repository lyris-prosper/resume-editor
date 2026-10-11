import type { TemplateId } from './schema'

export interface TemplateMeta {
  id: TemplateId
  name: string
  note: string
  /** 是否显示证件照 */
  photo?: boolean
}

/** 版式按经历丰富程度分组：内容少时留白从容，内容多时信息密度优先 */
export const TEMPLATE_GROUPS: { id: 'concise' | 'rich'; label: string; note: string; items: TemplateMeta[] }[] = [
  {
    id: 'concise',
    label: '一页简洁',
    note: '经历不多，一页放得下',
    items: [
      { id: 'classic', name: '简洁标准', note: '粗体标题、细线分节，最通用' },
      { id: 'banner', name: '页眉色带', note: '浅灰页眉，联系方式靠右' },
      { id: 'elegant', name: '衬线雅致', note: '衬线大字，可放证件照', photo: true },
      { id: 'airy', name: '现代留白', note: '标签悬挂，适合产品与运营' },
      { id: 'sidebar', name: '双栏名片', note: '侧栏放联系方式与技能', photo: true },
    ],
  },
  {
    id: 'rich',
    label: '履历丰富',
    note: '实习、项目多，适合应聘大厂',
    items: [
      { id: 'dense', name: '大厂高密度', note: '经历条带 + 加粗要点，适合技术岗' },
      { id: 'compact', name: '紧凑专业', note: '页边更窄，一页装下更多' },
      { id: 'academic', name: '学术科研', note: '衬线排版，教育与科研优先' },
    ],
  },
]

export const TEMPLATES: TemplateMeta[] = TEMPLATE_GROUPS.flatMap((g) => g.items)

export const templateMeta = (id: TemplateId) => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]

/** 每套版式默认的强调色；换版式时如果用户没改过颜色，就跟着换 */
export const TEMPLATE_ACCENT: Record<TemplateId, string> = {
  classic: '#111111',
  banner: '#111111',
  elegant: '#3b1f8f',
  airy: '#18202e',
  sidebar: '#23406b',
  dense: '#1768e5',
  compact: '#18202e',
  academic: '#18202e',
}

export const ACCENTS = ['#111111', '#1768e5', '#23406b', '#2f5d4a', '#3b1f8f', '#7a2b2b']
