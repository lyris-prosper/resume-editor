/**
 * 文字对比：把 AI 改写前后的两段话拆成“没变 / 删去 / 新写”的片段。
 * 中文按字、英文和数字按词切分，再把夹在两处修改之间的零碎字合并，读起来更像一处完整的改动。
 */

export type Op = { type: 'equal' | 'delete' | 'insert'; text: string }

export interface Hunk {
  id: number
  del: string
  ins: string
}

export type Segment = { kind: 'equal'; text: string } | { kind: 'change'; hunk: Hunk }

export type Decision = 'accept' | 'reject'

const TOKEN = /[A-Za-z0-9][A-Za-z0-9.%+#\-_/]*|\s+|[\s\S]/gu

function tokenize(s: string) {
  return s.match(TOKEN) ?? []
}

/** 最长公共子序列；文本只有一两句，O(n·m) 足够快 */
export function diffOps(a: string, b: string): Op[] {
  const A = tokenize(a)
  const B = tokenize(b)
  const n = A.length
  const m = B.length
  const w = m + 1
  const dp = new Uint16Array((n + 1) * w)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] = A[i] === B[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1])
    }
  }
  const ops: Op[] = []
  const push = (type: Op['type'], text: string) => {
    const last = ops[ops.length - 1]
    if (last && last.type === type) last.text += text
    else ops.push({ type, text })
  }
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      push('equal', A[i])
      i++
      j++
    } else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) push('delete', A[i++])
    else push('insert', B[j++])
  }
  while (i < n) push('delete', A[i++])
  while (j < m) push('insert', B[j++])
  return ops
}

/** 只有标点、空白，或者不超过两个字：这样的“没变”夹在修改之间时并入修改 */
function isGlue(text: string) {
  if (/^[\s，。、；：,.;:！？!?“”"'（）()·\-—]+$/.test(text)) return true
  return [...text].length <= 2
}

/**
 * 词语挪了位置（“对数据进行清洗” → “清洗数据”）会拆成前后两处修改，单独采纳其中一处会读不通。
 * 前一处新写的词出现在后一处删去的文字里（或反过来），且相隔不远时，视为同一处修改。
 */
function isMove(prev: { del: string; ins: string }, gap: string, next: { del: string; ins: string }) {
  if ([...gap].length > 16) return false
  const moved = (a: string, b: string) => a.trim().length >= 2 && b.includes(a.trim())
  return moved(prev.ins, next.del) || moved(prev.del, next.ins) || moved(next.ins, prev.del) || moved(next.del, prev.ins)
}

export function toSegments(ops: Op[]): Segment[] {
  // 先把相邻的删和增合成一处修改
  type Raw = { kind: 'equal'; text: string } | { kind: 'change'; del: string; ins: string }
  const raw: Raw[] = []
  for (const op of ops) {
    const last = raw[raw.length - 1]
    if (op.type === 'equal') raw.push({ kind: 'equal', text: op.text })
    else if (last?.kind === 'change') {
      if (op.type === 'delete') last.del += op.text
      else last.ins += op.text
    } else raw.push({ kind: 'change', del: op.type === 'delete' ? op.text : '', ins: op.type === 'insert' ? op.text : '' })
  }
  // 合并夹在两处修改之间的零碎文字
  let merged = true
  while (merged) {
    merged = false
    for (let k = 1; k < raw.length - 1; k++) {
      const prev = raw[k - 1]
      const mid = raw[k]
      const next = raw[k + 1]
      if (prev.kind === 'change' && mid.kind === 'equal' && next.kind === 'change' && (isGlue(mid.text) || isMove(prev, mid.text, next))) {
        raw.splice(k - 1, 3, { kind: 'change', del: prev.del + mid.text + next.del, ins: prev.ins + mid.text + next.ins })
        merged = true
        break
      }
    }
  }
  let id = 0
  return raw.map((r) => (r.kind === 'equal' ? r : { kind: 'change' as const, hunk: { id: id++, del: r.del, ins: r.ins } }))
}

export function diffSegments(a: string, b: string) {
  return toSegments(diffOps(a, b))
}

/** 按每处修改的决定拼出最终文字；没有决定的按 fallback 处理 */
export function compose(segments: Segment[], decisions: Record<number, Decision>, fallback: Decision) {
  return segments
    .map((s) => {
      if (s.kind === 'equal') return s.text
      const d = decisions[s.hunk.id] ?? fallback
      return d === 'accept' ? s.hunk.ins : s.hunk.del
    })
    .join('')
}

export function hunks(segments: Segment[]) {
  return segments.flatMap((s) => (s.kind === 'change' ? [s.hunk] : []))
}
