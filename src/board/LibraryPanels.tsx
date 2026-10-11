import { Plus, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useStore } from '../store/store'
import { uid } from '../lib/ids'
import { CATEGORY_LABEL, CATEGORY_ORDER, type Education, type ExperienceKind } from '../lib/schema'
import { AutoTextarea, Field, TextButton } from '../components/ui'

function Heading({ title, note, action }: { title: string; note?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-6">
      <div>
        <h2 className="text-[30px] font-semibold tracking-[0.04em]">{title}</h2>
        {note && <p className="mt-1.5 text-[14px] text-ink-3">{note}</p>}
      </div>
      {action}
    </div>
  )
}

export function ProfilePanel() {
  const profile = useStore((s) => s.library.profile)
  const update = useStore((s) => s.updateProfile)
  return (
    <div>
      <Heading title="个人信息" note="写在简历抬头里的内容" />
      <section className="grid grid-cols-2 gap-x-10 gap-y-6">
        <Field label="姓名">
          <input className="input-line text-[18px] font-semibold" value={profile.name} onChange={(e) => update((p) => void (p.name = e.target.value))} />
        </Field>
        <Field label="求职方向" hint="写在姓名下方，可以留空">
          <input className="input-line" placeholder="例如：产品运营" value={profile.headline} onChange={(e) => update((p) => void (p.headline = e.target.value))} />
        </Field>
        <Field label="电话">
          <input className="input-line num" value={profile.phone} onChange={(e) => update((p) => void (p.phone = e.target.value))} />
        </Field>
        <Field label="邮箱">
          <input className="input-line" value={profile.email} onChange={(e) => update((p) => void (p.email = e.target.value))} />
        </Field>
        <Field label="所在城市">
          <input className="input-line" value={profile.city} onChange={(e) => update((p) => void (p.city = e.target.value))} />
        </Field>
        <Field label="链接" hint="一行一个">
          <AutoTextarea
            className="input-line"
            value={profile.links.map((l) => l.url).join('\n')}
            onChange={(e) =>
              update(
                (p) =>
                  void (p.links = e.target.value
                    .split('\n')
                    .map((url) => ({ label: '', url: url.trim() }))
                    .filter((l, i, arr) => l.url || i === arr.length - 1)),
              )
            }
          />
        </Field>
        <Field label="个人概述" hint="可以留空" className="col-span-2">
          <AutoTextarea className="input-line" value={profile.summary} onChange={(e) => update((p) => void (p.summary = e.target.value))} />
        </Field>
      </section>
    </div>
  )
}

export function EducationPanel({ focusId }: { focusId?: string }) {
  const education = useStore((s) => s.library.profile.education)
  const update = useStore((s) => s.updateProfile)
  const toExperience = useStore((s) => s.educationToExperience)
  const navigate = useNavigate()

  const setEdu = (id: string, patch: Partial<Education>) =>
    update((p) => {
      const e = p.education.find((x) => x.id === id)
      if (e) Object.assign(e, patch)
    })

  return (
    <div>
      <Heading
        title="教育背景"
        note="学校、专业和时间"
        action={
          <button
            className="btn btn-outline btn-sm"
            onClick={() => update((p) => p.education.push({ id: uid('edu'), school: '', degree: '本科', major: '', start: '', end: '', details: '' }))}
          >
            <Plus size={14} strokeWidth={1.5} />
            添加
          </button>
        }
      />
      {education.length === 0 && <p className="border-t border-rule py-8 text-[14px] text-ink-3">还没有教育背景。</p>}
      {education.map((e) => (
        <div key={e.id} id={`edu-${e.id}`} className={`border-t border-rule py-8 ${focusId === e.id ? 'animate-flash rounded-[6px]' : ''}`}>
          <div className="mb-5 flex items-center gap-3">
            <select
              className="select-pill"
              value="education"
              aria-label="分类"
              onChange={(ev) => {
                const kind = ev.target.value as ExperienceKind
                const id = toExperience(e.id, kind)
                if (id) navigate(`/app/library/${id}`)
              }}
            >
              {CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {c === 'education' ? CATEGORY_LABEL[c] : `移到${CATEGORY_LABEL[c]}`}
                </option>
              ))}
            </select>
            <span className="flex-1" />
            <TextButton danger onClick={() => confirm(`删除“${e.school || '这条教育背景'}”？`) && update((p) => void (p.education = p.education.filter((x) => x.id !== e.id)))}>
              删除
            </TextButton>
          </div>
          <div className="grid grid-cols-[2fr_1fr] gap-x-8 gap-y-5">
            <Field label="学校">
              <input className="input-line text-[17px] font-semibold" value={e.school} onChange={(ev) => setEdu(e.id, { school: ev.target.value })} />
            </Field>
            <Field label="学历">
              <input className="input-line" value={e.degree} onChange={(ev) => setEdu(e.id, { degree: ev.target.value })} />
            </Field>
            <Field label="专业">
              <input className="input-line" value={e.major} onChange={(ev) => setEdu(e.id, { major: ev.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="开始">
                <input className="input-line num" value={e.start} onChange={(ev) => setEdu(e.id, { start: ev.target.value })} />
              </Field>
              <Field label="结束">
                <input className="input-line num" value={e.end} onChange={(ev) => setEdu(e.id, { end: ev.target.value })} />
              </Field>
            </div>
            <Field label="补充" hint="GPA、主修课程、排名" className="col-span-2">
              <AutoTextarea className="input-line" value={e.details} onChange={(ev) => setEdu(e.id, { details: ev.target.value })} />
            </Field>
          </div>
        </div>
      ))}
    </div>
  )
}

export function HonorsPanel() {
  const honors = useStore((s) => s.library.honors)
  const upsert = useStore((s) => s.upsertHonor)
  const remove = useStore((s) => s.deleteHonor)
  return (
    <div>
      <Heading
        title="荣誉奖项"
        note="奖学金、竞赛、证书"
        action={
          <button className="btn btn-outline btn-sm" onClick={() => upsert({ id: uid('hon'), title: '', date: '', issuer: '' })}>
            <Plus size={14} strokeWidth={1.5} />
            添加
          </button>
        }
      />
      <div className="border-t border-rule">
        {honors.map((h) => (
          <div key={h.id} className="group grid grid-cols-[1fr_200px_110px_28px] items-center gap-6 border-b border-rule py-4">
            <input className="input-line border-transparent text-[16px] font-semibold" placeholder="奖项名称" value={h.title} onChange={(e) => upsert({ ...h, title: e.target.value })} />
            <input className="input-line border-transparent text-ink-2" placeholder="颁发方" value={h.issuer} onChange={(e) => upsert({ ...h, issuer: e.target.value })} />
            <input className="input-line num border-transparent text-ink-2" placeholder="2025.10" value={h.date} onChange={(e) => upsert({ ...h, date: e.target.value })} />
            <button className="text-ink-4 opacity-0 transition-opacity hover:text-ink focus:opacity-100 group-hover:opacity-100" onClick={() => remove(h.id)} aria-label="删除">
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkillsPanel() {
  const skills = useStore((s) => s.library.skills)
  const upsert = useStore((s) => s.upsertSkill)
  const remove = useStore((s) => s.deleteSkill)
  return (
    <div>
      <Heading
        title="技能"
        note="按分组列出工具、语言和证书"
        action={
          <button className="btn btn-outline btn-sm" onClick={() => upsert({ id: uid('sk'), label: '', items: [] })}>
            <Plus size={14} strokeWidth={1.5} />
            添加分组
          </button>
        }
      />
      <div className="border-t border-rule">
        {skills.map((s) => (
          <div key={s.id} className="group grid grid-cols-[120px_1fr_28px] items-center gap-6 border-b border-rule py-4">
            <input className="input-line border-transparent text-[16px] font-semibold" placeholder="分组" value={s.label} onChange={(e) => upsert({ ...s, label: e.target.value })} />
            <input
              className="input-line border-transparent text-ink-2"
              placeholder="用顿号分隔，如：Excel、SQL"
              value={s.items.join('、')}
              onChange={(e) => upsert({ ...s, items: e.target.value.split(/[、,，]/).map((x) => x.trim()) })}
              onBlur={() => upsert({ ...s, items: s.items.filter(Boolean) })}
            />
            <button className="text-ink-4 opacity-0 transition-opacity hover:text-ink focus:opacity-100 group-hover:opacity-100" onClick={() => remove(s.id)} aria-label="删除">
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
