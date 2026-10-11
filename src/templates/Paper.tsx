import { forwardRef, type CSSProperties, type ReactNode } from 'react'
import { EXPERIENCE_SECTIONS, type Resume, type ResumeItem, type ResumeSection, type TemplateId } from '../lib/schema'
import './paper.css'

export const A4 = { width: 794, height: 1123 }

export { TEMPLATES, ACCENTS } from '../lib/templates'

/** 交给预览层的回调：点击纸面上的条目，定位到左侧编辑框 */
export interface PaperHandlers {
  onPick?: (target: { sectionId: string; itemId?: string; bulletId?: string }) => void
  activeId?: string
}

/** 条目的排法：一行（机构 - 职位 + 时间）、两行（机构 / 职位 + 时间）、条带（高密度版的色带标题） */
type ItemLayout = 'line' | 'stack' | 'strip'

const LAYOUT: Record<TemplateId, ItemLayout> = {
  classic: 'line',
  banner: 'stack',
  elegant: 'stack',
  airy: 'line',
  sidebar: 'line',
  dense: 'strip',
  compact: 'line',
  academic: 'line',
}

const visible = <T extends { hidden: boolean }>(xs: T[]) => xs.filter((x) => !x.hidden)
const isExperience = (s: ResumeSection) => EXPERIENCE_SECTIONS.includes(s.kind)

function Clickable({
  id,
  handlers,
  target,
  className = '',
  children,
  as: Tag = 'div',
}: {
  id: string
  handlers: PaperHandlers
  target: Parameters<NonNullable<PaperHandlers['onPick']>>[0]
  className?: string
  children: ReactNode
  as?: 'div' | 'li'
}) {
  if (!handlers.onPick) return <Tag className={className}>{children}</Tag>
  return (
    <Tag
      className={`${className} cursor-text rounded-[2px] outline-offset-2 transition-[outline-color] hover:outline hover:outline-1 hover:outline-[#11111140] ${
        handlers.activeId === id ? 'outline outline-1 outline-[#111111]' : ''
      }`}
      onClick={(e) => {
        e.stopPropagation()
        handlers.onPick?.(target)
      }}
    >
      {children}
    </Tag>
  )
}

/** 预览里把待补的【补充：…】标出来，提醒用户填写；导出时原样输出 */
function Text({ text, preview }: { text: string; preview: boolean }) {
  if (!preview || !text.includes('【补充：')) return <>{text}</>
  return (
    <>
      {text.split(/(【补充：[^】]{1,24}】)/).map((p, i) =>
        p.startsWith('【补充：') ? (
          <mark key={i} className="cv-todo">
            {p}
          </mark>
        ) : (
          p
        ),
      )}
    </>
  )
}

function Bullets({ item, section, handlers, marker }: { item: ResumeItem; section: ResumeSection; handlers: PaperHandlers; marker: string }) {
  const bullets = visible(item.bullets)
  if (!bullets.length) return null
  return (
    <ul className="cv-bullets">
      {bullets.map((b) => (
        <Clickable as="li" key={b.id} id={b.id} handlers={handlers} target={{ sectionId: section.id, itemId: item.id, bulletId: b.id }} className="cv-bullet">
          <span className="cv-marker" aria-hidden>
            {marker}
          </span>
          <span>
            {b.lead && <strong className="cv-lead">{b.lead}：</strong>}
            <Text text={b.text} preview={!!handlers.onPick} />
          </span>
        </Clickable>
      ))}
    </ul>
  )
}

function ItemHead({ item, section, layout }: { item: ResumeItem; section: ResumeSection; layout: ItemLayout }) {
  const exp = isExperience(section)
  if (layout === 'strip' && exp) {
    // 高密度版：经历一律用色带标题；项目类用加粗标题
    if (section.kind === 'project' || section.kind === 'research') {
      return (
        <div className="cv-item-head cv-project-head">
          <span className="cv-heading">
            {item.heading}
            {item.subheading && <span className="cv-heading-sub">｜{item.subheading}</span>}
          </span>
          {item.date && <span className="cv-date">{item.date}</span>}
        </div>
      )
    }
    return (
      <div className="cv-strip">
        <span className="cv-heading">{item.heading}</span>
        <span className="cv-strip-right">
          {item.subheading}
          {item.subheading && item.date && <span className="cv-strip-sep">｜</span>}
          {item.date}
        </span>
      </div>
    )
  }
  if (layout === 'stack' || !exp) {
    return (
      <div className="cv-item-head cv-stack">
        <span className="cv-heading">{item.heading}</span>
        {item.date && <span className="cv-date">{item.date}</span>}
        {item.subheading && <span className="cv-sub">{item.subheading}</span>}
      </div>
    )
  }
  return (
    <div className="cv-item-head">
      <span className="cv-heading">
        {item.heading}
        {item.subheading && ` - ${item.subheading}`}
      </span>
      {item.date && <span className="cv-date">{item.date}</span>}
    </div>
  )
}

function ItemBlock({ item, section, handlers, layout, marker }: { item: ResumeItem; section: ResumeSection; handlers: PaperHandlers; layout: ItemLayout; marker: string }) {
  if (section.kind === 'skill' || section.kind === 'honor') {
    return (
      <Clickable id={item.id} handlers={handlers} target={{ sectionId: section.id, itemId: item.id }} className="cv-inline">
        {layout === 'strip' && section.kind === 'skill' && (
          <span className="cv-marker" aria-hidden>
            {marker}
          </span>
        )}
        <span className="cv-inline-head">{item.heading}</span>
        {item.subheading && (
          <>
            <span className="cv-inline-sep">{section.kind === 'skill' ? '：' : ' · '}</span>
            <span className="cv-inline-sub">{item.subheading}</span>
          </>
        )}
        {item.date && <span className="cv-date">{item.date}</span>}
      </Clickable>
    )
  }
  return (
    <div className="cv-item">
      <Clickable id={item.id} handlers={handlers} target={{ sectionId: section.id, itemId: item.id }}>
        <ItemHead item={item} section={section} layout={layout} />
      </Clickable>
      <Bullets item={item} section={section} handlers={handlers} marker={marker} />
    </div>
  )
}

function Sections({ sections, handlers, layout, marker = '•' }: { sections: ResumeSection[]; handlers: PaperHandlers; layout: ItemLayout; marker?: string }) {
  return (
    <>
      {sections.map((s) => (
        <section key={s.id} className={`cv-section cv-section-${s.kind}`}>
          <h2 className="cv-section-title">
            <span>{s.title}</span>
          </h2>
          <div className="cv-section-body">
            {visible(s.items).map((it) => (
              <ItemBlock key={it.id} item={it} section={s} handlers={handlers} layout={layout} marker={marker} />
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

/* ---------- 抬头 ---------- */

/** 联系方式前的小图标：按内容判断是邮箱、电话、地址还是链接 */
function ContactIcon({ value }: { value: string }) {
  const kind = /@/.test(value) ? 'mail' : /\d{3}[-\s]?\d{3,4}[-\s]?\d{3,4}/.test(value) ? 'phone' : /https?:|www\.|\.com|\.cn|github/i.test(value) ? 'link' : 'pin'
  const path = {
    mail: <path d="M3 6.5h18v11H3zM3.5 7l8.5 6.5L20.5 7" />,
    phone: <path d="M6.5 3.5h3l1.5 4-2 1.3a10 10 0 0 0 6.2 6.2l1.3-2 4 1.5v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2z" />,
    pin: <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />,
    link: <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />,
  }[kind]
  return (
    <svg className="cv-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {path}
    </svg>
  )
}

function Photo({ src }: { src?: string }) {
  if (!src) return null
  return <img className="cv-photo" src={src} alt="" />
}

function Header({ resume, align = 'left', photo }: { resume: Resume; align?: 'left' | 'center'; photo?: boolean }) {
  const { header } = resume
  const contacts = header.contacts.filter(Boolean)
  return (
    <header className={`cv-header ${align === 'center' ? 'text-center' : ''}`}>
      {photo && <Photo src={header.photo} />}
      <div className="cv-header-main">
        <h1 className="cv-name">{header.name}</h1>
        {header.headline && <p className="cv-headline">{header.headline}</p>}
        <div className={`cv-contacts ${align === 'center' ? 'justify-center' : ''}`}>
          {contacts.map((c, i) => (
            <span key={i}>{c}</span>
          ))}
        </div>
      </div>
      {header.summary && <p className="cv-summary">{header.summary}</p>}
    </header>
  )
}

/** 页眉色带：姓名在左，联系方式靠右并配图标 */
function BannerHeader({ resume }: { resume: Resume }) {
  const { header } = resume
  return (
    <header className="cv-header cv-band">
      <div className="cv-header-main">
        <h1 className="cv-name">{header.name}</h1>
        {header.headline && <p className="cv-headline">{header.headline}</p>}
      </div>
      <div className="cv-contacts">
        {header.contacts.filter(Boolean).map((c, i) => (
          <span key={i}>
            {c}
            <ContactIcon value={c} />
          </span>
        ))}
      </div>
    </header>
  )
}

/** 高密度版：教育背景写进抬头，一行一所学校 */
function DenseHeader({ resume, education, handlers }: { resume: Resume; education?: ResumeSection; handlers: PaperHandlers }) {
  const { header } = resume
  return (
    <header className="cv-header">
      <h1 className="cv-name">{header.name}</h1>
      <div className="cv-contacts">
        {header.contacts.filter(Boolean).map((c, i) => (
          <span key={i}>{c}</span>
        ))}
      </div>
      {header.headline && <p className="cv-headline">{header.headline}</p>}
      {education &&
        visible(education.items).map((it) => (
          <Clickable key={it.id} id={it.id} handlers={handlers} target={{ sectionId: education.id, itemId: it.id }} className="cv-edu-row">
            <strong>{it.heading}</strong>
            {it.subheading && <span>　{it.subheading.replace(/，/g, '｜')}</span>}
            {it.date && <span>｜{it.date}</span>}
            {visible(it.bullets)
              .map((b) => b.text)
              .filter(Boolean)
              .map((t, i) => (
                <span key={i} className="cv-edu-note">
                  {'　'}
                  {t}
                </span>
              ))}
          </Clickable>
        ))}
      {header.summary && <p className="cv-summary">{header.summary}</p>}
    </header>
  )
}

export const Paper = forwardRef<HTMLDivElement, { resume: Resume; handlers?: PaperHandlers; className?: string }>(function Paper({ resume, handlers = {}, className = '' }, ref) {
  const { template, style } = resume
  const sections = visible(resume.sections).filter((s) => visible(s.items).length > 0)
  const layout = LAYOUT[template] ?? 'line'
  const vars = {
    '--cv-accent': style.accent,
    '--cv-scale': style.fontScale,
    '--cv-leading': style.lineHeight,
  } as CSSProperties

  let body: ReactNode
  if (template === 'sidebar') {
    const sideKinds = new Set(['education', 'skill', 'honor'])
    const side = sections.filter((s) => sideKinds.has(s.kind))
    const main = sections.filter((s) => !sideKinds.has(s.kind))
    body = (
      <div className="cv-two">
        <aside className="cv-side">
          <Header resume={resume} photo />
          <Sections sections={side} handlers={handlers} layout="stack" />
        </aside>
        <div className="cv-main">
          <Sections sections={main} handlers={handlers} layout={layout} />
        </div>
      </div>
    )
  } else if (template === 'dense') {
    const education = sections.find((s) => s.kind === 'education')
    body = (
      <>
        <DenseHeader resume={resume} education={education} handlers={handlers} />
        <Sections sections={sections.filter((s) => s !== education)} handlers={handlers} layout={layout} />
      </>
    )
  } else if (template === 'banner') {
    body = (
      <>
        <BannerHeader resume={resume} />
        <div className="cv-body">
          {resume.header.summary && <p className="cv-summary">{resume.header.summary}</p>}
          <Sections sections={sections} handlers={handlers} layout={layout} />
        </div>
      </>
    )
  } else {
    body = (
      <>
        <Header resume={resume} align={template === 'academic' ? 'center' : 'left'} photo={template === 'elegant'} />
        <Sections sections={sections} handlers={handlers} layout={layout} marker={template === 'academic' ? '–' : '•'} />
      </>
    )
  }

  return (
    <div ref={ref} className={`cv-paper cv-${template} ${className}`} style={vars}>
      {body}
    </div>
  )
})
