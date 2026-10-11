import { remoteProvider } from './remote'
import type { AiProvider } from './types'

/**
 * 当前使用的 AI：配置了 DeepSeek 密钥（项目根目录 .env.local）就用 DeepSeek，
 * 否则、或调用失败时自动改用本地规则（./mock.ts）。页面代码不需要关心是哪一种。
 */
export const ai: AiProvider = remoteProvider

export { refreshStatus, useAi } from './remote'
export type * from './types'
