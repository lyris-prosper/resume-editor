import { useCallback, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { ChevronDown, Download, FilePlus2, FileUp, MessageCircle, Plus, RotateCcw, Upload } from 'lucide-react'
import { z } from 'zod'
import { useStore } from '../store/store'
import { ai } from '../lib/ai'
import { JobTarget, Library, Resume, type Experience } from '../lib/schema'
import { uid } from '../lib/ids'
import { useDismiss } from '../lib/useDismiss'
import { Brand } from '../components/Brand'
import { AiBadge } from '../components/AiNotice'

const Backup = z.object({ library: Library, jobs: z.array(JobTarget), resumes: z.array(Resume) })

function Tab({ to, label, count, end }: { to: string; label: string; count?: number; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `group relative flex h-16 items-center whitespace-nowrap text-[14px] tracking-[0.04em] transition-colors sm:text-[15px] ${
          isActive ? 'text-ink' : 'text-ink-3 hover:text-ink'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {label}
          {count !== undefined && count > 0 && <sup className="num ml-0.5 text-[10.5px] text-ink-3">{count}</sup>}
          <span
            className={`absolute inset-x-0 -bottom-px h-[2px] bg-ink transition-transform duration-300 ${
              isActive ? 'scale-x-100' : 'scale-x-0'
            }`}
          />
        </>
      )}
    </NavLink>
  )
}

function AddMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)
  const navigate = useNavigate()
  const upsertExperience = useStore((s) => s.upsertExperience)

  const go = (to: string) => {
    setOpen(false)
    navigate(to)
  }

  const manual = () => {
    const exp: Experience = {
      id: uid('exp'),
      kind: 'internship',
      org: '',
      role: '',
      employmentType: 'internship',
      start: '',
      end: '',
      summary: '',
      rawText: '',
      version: 1,
      updatedAt: Date.now(),
    }
    upsertExperience(exp)
    go(`/app/library/${exp.id}`)
  }

  const items = [
    { icon: <FileUp size={16} strokeWidth={1.5} />, title: '导入简历或材料', note: 'PDF、文字都可以，自动分类', onClick: () => go('/app/import') },
    { icon: <MessageCircle size={16} strokeWidth={1.5} />, title: '和 AI 聊一段', note: '一问一答，边聊边成稿', onClick: () => go('/app/chat') },
    { icon: <FilePlus2 size={16} strokeWidth={1.5} />, title: '手动填写', note: '自己逐项记下来', onClick: manual },
  ]

  return (
    <div ref={ref} className="relative">
      <button className="btn btn-outline btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <Plus size={14} strokeWidth={1.75} />
        <span className="hidden sm:inline">添加经历</span>
      </button>
      {open && (
        <div role="menu" className="pop absolute right-0 top-11 z-40 w-[260px] animate-rise p-1.5">
          {items.map((it) => (
            <button
              key={it.title}
              role="menuitem"
              onClick={it.onClick}
              className="flex w-full items-start gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors hover:bg-mist"
            >
              <span className="mt-1 text-ink-2">{it.icon}</span>
              <span>
                <span className="block text-[14.5px] text-ink">{it.title}</span>
                <span className="block text-[12.5px] text-ink-3">{it.note}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function StorageMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)
  const replaceAll = useStore((s) => s.replaceAll)
  const loadDemo = useStore((s) => s.loadDemo)
  const clearAll = useStore((s) => s.clearAll)
  const navigate = useNavigate()

  const exportBackup = () => {
    const { library, jobs, resumes } = useStore.getState()
    const blob = new Blob([JSON.stringify({ library, jobs, resumes }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `拾历备份-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importBackup = async (file: File) => {
    try {
      const parsed = Backup.parse(JSON.parse(await file.text()))
      if (confirm('恢复备份会替换当前浏览器里的全部资料，确定继续？')) replaceAll(parsed)
    } catch {
      alert('这个文件不是有效的拾历备份。请选择从“备份”导出的 JSON 文件。')
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] text-ink-3 transition-colors hover:bg-mist hover:text-ink"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="size-1.5 rounded-full bg-ink-4" aria-hidden />
        <span className="hidden md:inline">本机保存</span>
        <ChevronDown size={13} strokeWidth={1.5} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="pop absolute right-0 top-11 z-40 w-[300px] animate-rise p-5">
          <p className="text-[13.5px] leading-relaxed text-ink-2">资料只保存在这台电脑的浏览器里。换设备、清理浏览器之前，请先备份。</p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">
            AI：{ai.name}
            {!ai.name.startsWith('DeepSeek') && <span className="block">在项目根目录 .env.local 里填写 DEEPSEEK_API_KEY 即可接入</span>}
          </p>
          <div className="mt-4 flex gap-2">
            <button className="btn btn-outline btn-sm" onClick={exportBackup}>
              <Download size={13} strokeWidth={1.5} />
              备份
            </button>
            <button className="btn btn-quiet btn-sm" onClick={() => fileRef.current?.click()}>
              <Upload size={13} strokeWidth={1.5} />
              恢复
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) importBackup(f)
                e.target.value = ''
              }}
            />
          </div>
          <div className="mt-4 flex gap-4 border-t border-rule pt-3 text-[12.5px] text-ink-3">
            <button
              className="link-reveal hover:text-ink"
              onClick={() => {
                if (confirm('载入演示资料会替换当前事实库（岗位和简历保留），确定继续？')) {
                  loadDemo()
                  setOpen(false)
                  navigate('/app')
                }
              }}
            >
              <RotateCcw size={11} strokeWidth={1.5} className="mr-1 inline" />
              载入演示资料
            </button>
            <button
              className="link-reveal hover:text-ink"
              onClick={() => {
                if (confirm('清空后，事实库、岗位和简历都会删除且无法恢复。建议先备份。确定清空？')) {
                  clearAll()
                  setOpen(false)
                  navigate('/app')
                }
              }}
            >
              清空全部
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function TopBar() {
  const experiences = useStore((s) => s.library.experiences.length + s.library.profile.education.length)
  const jobs = useStore((s) => s.jobs.length)
  const resumes = useStore((s) => s.resumes.length)

  return (
    <header className="no-print sticky top-0 z-30 border-b border-rule bg-paper/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="flex h-16 items-center gap-5 px-4 sm:px-8 md:gap-12">
        <Brand to="/" compact />
        <nav className="flex min-w-0 items-center gap-4 sm:gap-8" aria-label="工作台">
          <Tab to="/app" end label="工作台" />
          <Tab to="/app/library" label="事实库" count={experiences} />
          <Tab to="/app/jobs" label="岗位" count={jobs} />
          <Tab to="/app/resumes" label="简历" count={resumes} />
        </nav>
        <div className="ml-auto hidden items-center gap-2 sm:flex sm:gap-3">
          <AiBadge />
          <StorageMenu />
          <AddMenu />
        </div>
      </div>
    </header>
  )
}
