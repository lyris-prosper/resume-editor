/** 匹配程度：实心 = 有依据，半实心 = 部分相关，虚线空心 = 待补充；菱形 = 门槛条件 */
export function LevelDot({ level, label }: { level: 'full' | 'half' | 'none' | 'gate'; label?: string }) {
  if (level === 'gate')
    return (
      <span className="grid size-[13px] shrink-0 place-items-center" title={label} aria-label={label}>
        <span className="size-[8px] rotate-45 border border-ink-3" />
      </span>
    )
  return (
    <span
      className="inline-block size-[11px] shrink-0 rounded-full border border-ink"
      style={{
        background:
          level === 'full' ? 'var(--color-ink)' : level === 'half' ? 'linear-gradient(90deg, var(--color-ink) 50%, transparent 50%)' : 'transparent',
        borderStyle: level === 'none' ? 'dashed' : 'solid',
        borderColor: level === 'none' ? 'var(--color-ink-3)' : undefined,
      }}
      title={label}
      aria-label={label}
      role={label ? 'img' : undefined}
    />
  )
}
