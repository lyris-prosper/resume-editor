import { Navigate, Outlet, Route, Routes, useLocation, useSearchParams } from 'react-router'
import { TopBar } from './board/TopBar'
import { AiNotice } from './components/AiNotice'
import { useHydrated } from './lib/useHydrated'
import { LandingPage } from './landing/LandingPage'
import { HomePage } from './pages/HomePage'
import { LibraryPage } from './pages/LibraryPage'
import { ImportPage } from './pages/ImportPage'
import { ChatPage } from './pages/ChatPage'
import { RewritePage } from './pages/RewritePage'
import { JobsPage } from './pages/JobsPage'
import { ResumesPage } from './pages/ResumesPage'

/** 工作台外框：顶栏 + 页面。页面在资料读回之后才渲染 */
function Board() {
  const hydrated = useHydrated()
  const { pathname } = useLocation()
  // 首页适配平板和手机；其余页面是桌面工具，保持最小宽度
  const wide = pathname !== '/app' && pathname !== '/app/'
  return (
    <div className={`flex h-dvh flex-col ${wide ? 'min-w-[1024px]' : ''}`}>
      <TopBar />
      <main className="relative min-h-0 flex-1">
        {hydrated ? <Outlet /> : <div className="grid h-full place-items-center text-ink-3">正在读取本机资料…</div>}
      </main>
      <AiNotice />
    </div>
  )
}

/** 旧的“添加经历”地址 */
function LegacyAdd() {
  const [params] = useSearchParams()
  if (params.get('mode') === 'import') return <Navigate to="/app/import" replace />
  const rest = new URLSearchParams(params)
  rest.delete('mode')
  const q = rest.toString()
  return <Navigate to={`/app/chat${q ? `?${q}` : ''}`} replace />
}

/** 旧地址跳到新的工作台路径 */
function Legacy({ to }: { to: string }) {
  const { pathname, search } = useLocation()
  const rest = pathname.split('/').slice(2).join('/')
  return <Navigate to={`${to}${rest ? `/${rest}` : ''}${search}`} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app" element={<Board />}>
        <Route index element={<HomePage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="library/:experienceId" element={<LibraryPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="add" element={<LegacyAdd />} />
        <Route path="rewrite" element={<RewritePage />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="jobs/:jobId" element={<JobsPage />} />
        <Route path="resumes" element={<ResumesPage />} />
        <Route path="resumes/:resumeId" element={<ResumesPage />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Route>
      <Route path="/library/*" element={<Legacy to="/app/library" />} />
      <Route path="/jobs/*" element={<Legacy to="/app/jobs" />} />
      <Route path="/studio/*" element={<Legacy to="/app/resumes" />} />
      <Route path="/interview" element={<Navigate to="/app/chat" replace />} />
      <Route path="/import" element={<Navigate to="/app/import" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
