import { Link, useSearchParams } from 'react-router'
import { ChatView } from '../board/ChatView'

/** 和 AI 聊一段经历：一问一答，右侧草稿随对话生成 */
export function ChatPage() {
  const [params] = useSearchParams()
  const patching = params.get('event') || params.get('exp')
  const header = (
    <div className="mx-auto flex w-full max-w-[776px] items-end justify-between gap-6 px-12 pb-6 pt-10">
      <div>
        <p className="label">添加经历</p>
        <h1 className="mt-1.5 text-[30px] font-semibold leading-tight tracking-[0.04em]">{patching ? '把这件事聊完整' : '和 AI 聊一段经历'}</h1>
      </div>
      {!patching && (
        <Link to="/app/import" className="link-reveal pb-1.5 text-[14px] text-ink-3 hover:text-ink">
          有现成的简历？直接导入
        </Link>
      )}
    </div>
  )
  return <ChatView header={header} />
}
