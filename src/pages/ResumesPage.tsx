import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useStore } from '../store/store'
import type { Resume } from '../lib/schema'
import { assembleResume, sourceItems } from '../lib/assemble'
import { exportPng, printPdf, safeName } from '../lib/export'
import { relativeTime } from '../lib/format'
import { todos } from '../lib/facts'
import { uid } from '../lib/ids'
import { A4, Paper } from '../templates/Paper'
import { templateMeta } from '../lib/templates'
import { EditorPanel } from '../board/studio/EditorPanel'
import { Preview, StyleMenu, TemplateSwitch } from '../board/studio/Preview'
import { Empty, PageTitle, TextButton } from '../components/ui'

function Thumb({ resume }: { resume: Resume }) {
  const scale = 0.3
  return (
    <div className="paper-shadow pointer-events-none overflow-hidden rounded-[2px] bg-white" style={{ width: A4.width * scale, height: A4.height * scale }}>
      <div className="origin-top-left" style={{ transform: `scale(${scale})` }}>
        <Paper resume={resume} />
      </div>
    </div>
  )
}

function ResumeList() {
  const resumes = useStore((s) => s.resumes)
  const jobs = useStore((s) => s.jobs)
  const library = useStore((s) => s.library)
  const upsertResume = useStore((s) => s.upsertResume)
  const deleteResume = useStore((s) => s.deleteResume)
  const navigate = useNavigate()

  const createGeneral = () => {
    const picks = library.events.map((e) => ({ eventId: e.id, variantId: e.variants[0]?.id }))
    const r = assembleResume({ library, picks, template: picks.length > 10 ? 'dense' : 'classic' })
    upsertResume(r)
    navigate(`/app/resumes/${r.id}`)
  }

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-[1180px] px-14 pb-28 pt-12">
        <PageTitle
          title="简历"
          meta="每份简历都是独立的快照，之后修改事实库不会改动它"
          actions={
            <>
              <button className="btn btn-outline btn-sm" onClick={createGeneral}>
                用全部经历生成通用版
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/app', { state: { side: 'job' } })}>
                按岗位生成
              </button>
            </>
          }
        />
        {resumes.length === 0 ? (
          <Empty
            title="还没有简历"
            action={
              <button className="btn btn-primary" onClick={() => navigate('/app', { state: { side: 'job' } })}>
                粘贴一份招聘信息
              </button>
            }
          >
            粘贴想投的岗位，从事实库里挑出相关的经历；也可以先生成一份通用版。
          </Empty>
        ) : (
          <div className="mt-12 grid grid-cols-[repeat(auto-fill,minmax(238px,1fr))] gap-x-10 gap-y-14">
            {resumes.map((r) => {
              const job = jobs.find((j) => j.id === r.jobId)
              return (
                <div key={r.id} className="group">
                  <button onClick={() => navigate(`/app/resumes/${r.id}`)} className="block text-left" aria-label={`打开 ${r.name}`}>
                    <div className="transition-transform duration-300 group-hover:-translate-y-1">
                      <Thumb resume={r} />
                    </div>
                    <div className="mt-5 text-[16px] font-semibold leading-snug">{r.name}</div>
                  </button>
                  <div className="mt-1 text-[13px] text-ink-3">
                    {templateMeta(r.template).name} · <span className="num">{sourceItems(r).length}</span> 件事 ·{' '}
                    <span className="num">{relativeTime(r.updatedAt)}</span>
                  </div>
                  {job && <div className="mt-0.5 truncate text-[13px] text-ink-3">岗位：{job.title || job.company}</div>}
                  <div className="mt-2 flex gap-4 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <TextButton
                      onClick={() =>
                        upsertResume({ ...structuredClone(r), id: uid('cv'), name: `${r.name}（副本）`, createdAt: Date.now(), updatedAt: Date.now() })
                      }
                    >
                      复制
                    </TextButton>
                    <TextButton danger onClick={() => confirm(`删除“${r.name}”？事实库不受影响。`) && deleteResume(r.id)}>
                      删除
                    </TextButton>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Studio({ resume }: { resume: Resume }) {
  const updateResume = useStore((s) => s.updateResume)
  const job = useStore((s) => s.jobs.find((j) => j.id === resume.jobId))
  const navigate = useNavigate()
  const [activeId, setActiveId] = useState<string>()
  const [status, setStatus] = useState<string | null>(null)
  const exportRef = useRef<HTMLDivElement>(null)

  const update = useCallback((fn: (r: Resume) => void) => updateResume(resume.id, fn), [resume.id, updateResume])

  const onPick = useCallback((t: { itemId?: string; bulletId?: string }) => {
    const id = t.bulletId ?? t.itemId
    if (!id) return
    setActiveId(id)
    const el = document.getElementById(`ed-${id}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el?.querySelector<HTMLElement>('textarea, input')?.focus({ preventScroll: true })
  }, [])

  const doPng = async () => {
    if (!exportRef.current) return
    setStatus('正在生成图片…')
    try {
      const pages = await exportPng(exportRef.current, safeName(resume.name))
      setStatus(`已导出 ${pages} 张图片`)
    } catch (e) {
      console.error(e)
      setStatus('图片没有导出成功，内容没有丢失，可以再试一次')
    }
    setTimeout(() => setStatus(null), 2800)
  }

  const exporting = status?.startsWith('正在')
  const pendingTodos = resume.sections.reduce(
    (n, s) => n + (s.hidden ? 0 : s.items.reduce((m, i) => m + (i.hidden ? 0 : i.bullets.reduce((k, b) => k + (b.hidden ? 0 : todos(b.text).length), 0)), 0)),
    0,
  )

  return (
    <div className="flex h-full flex-col">
      <div className="no-print flex h-[68px] shrink-0 items-center gap-5 border-b border-rule px-6">
        <button className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-mist hover:text-ink" onClick={() => navigate('/app/resumes')} aria-label="返回简历列表">
          <ArrowLeft size={18} strokeWidth={1.5} />
        </button>
        <div className="min-w-0 flex-1">
          <input
            className="inline-edit w-full max-w-[520px] text-[19px] font-semibold tracking-[0.02em]"
            value={resume.name}
            onChange={(e) => update((r) => void (r.name = e.target.value))}
            aria-label="简历名称"
          />
          <div className="truncate text-[12.5px] text-ink-3">
            {job ? `按「${job.title || '未识别职位'}」适配` : '通用版本'} · 采用 <span className="num">{sourceItems(resume).length}</span> 件事 · 已自动保存{' '}
            <span className="num">{relativeTime(resume.updatedAt)}</span>
            {pendingTodos > 0 && <span className="ml-2 text-alert">· 还有 {pendingTodos} 处【补充】没填，导出前记得补上</span>}
          </div>
        </div>
        <TemplateSwitch resume={resume} update={update} />
        <span className="h-8 w-px bg-rule" aria-hidden />
        <StyleMenu resume={resume} update={update} />
        {status && <span className="text-[13px] text-ink-2">{status}</span>}
        <button className="btn btn-outline btn-sm" onClick={doPng} disabled={exporting}>
          {exporting && <Loader2 size={13} className="animate-spin" />}
          导出图片
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => printPdf(safeName(resume.name))} title="在打印窗口里选择“存储为 PDF”">
          导出 PDF
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="scroll-thin w-[460px] shrink-0 overflow-y-auto border-r border-rule">
          <EditorPanel resume={resume} update={update} activeId={activeId} setActiveId={setActiveId} />
        </div>
        <div className="scroll-thin min-w-0 flex-1 overflow-y-auto" onClick={() => setActiveId(undefined)}>
          <Preview resume={resume} handlers={{ onPick, activeId }} />
        </div>
      </div>

      {createPortal(
        <div className="export-stage" style={{ position: 'fixed', left: -10000, top: 0 }} aria-hidden>
          <Paper ref={exportRef} resume={resume} />
        </div>,
        document.body,
      )}
    </div>
  )
}

export function ResumesPage() {
  const { resumeId } = useParams()
  const resume = useStore((s) => s.resumes.find((r) => r.id === resumeId))
  if (resumeId && !resume) return <Empty title="找不到这份简历">它可能已经被删除。事实库里的资料不受影响。</Empty>
  return resume ? <Studio key={resume.id} resume={resume} /> : <ResumeList />
}
