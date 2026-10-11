import type { Event } from './schema'

const NUM = /\d+(?:\.\d+)?\s*%?/g

/** 等用户填写的数字：AI 改写时，需要但事实里没有的数字用【补充：…】占位 */
export const TODO = /【补充：([^】]{1,24})】/g

export const stripTodos = (text: string) => text.replace(TODO, '')

/** 文本里还没填的占位，返回说明文字 */
export function todos(text: string) {
  return [...text.matchAll(TODO)].map((m) => m[1])
}

/**
 * 文本里出现、但这件事的事实记录中没有的数字。
 * 用于在改写和回写时提醒：数字只能来自事实，不能凭空出现。
 */
export function unsupportedNumbers(text: string, event: Pick<Event, 'background' | 'action' | 'result' | 'metrics'>) {
  const factText = [event.background, event.action, event.result, ...event.metrics].join(' ')
  const known = new Set((factText.match(NUM) ?? []).map((n) => n.replace(/\s/g, '')))
  return [...new Set((stripTodos(text).match(NUM) ?? []).map((n) => n.replace(/\s/g, '')))].filter((n) => !known.has(n))
}

export function move<T>(arr: T[], index: number, dir: -1 | 1) {
  const to = index + dir
  if (to < 0 || to >= arr.length) return
  ;[arr[index], arr[to]] = [arr[to], arr[index]]
}
