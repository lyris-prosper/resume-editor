import type { TemplateId } from '../lib/schema'

/** 每套模板的缩略示意：只画版面结构，不画文字 */
export function Schematic({ id, className = 'h-10 w-[30px]' }: { id: TemplateId; className?: string }) {
  const line = (x: number, y: number, w: number, o = 0.35) => <rect x={x} y={y} width={w} height={1.4} rx={0.7} fill="currentColor" opacity={o} />
  return (
    <svg viewBox="0 0 30 40" className={className} aria-hidden>
      <rect x="0.5" y="0.5" width="29" height="39" rx="1.5" fill="white" stroke="currentColor" strokeOpacity="0.3" />
      {id === 'classic' && (
        <>
          <rect x="4" y="3.5" width="14" height="2.6" rx="0.8" fill="currentColor" opacity="0.9" />
          {line(4, 7.5, 18, 0.3)}
          <rect x="4" y="10" width="22" height="0.9" fill="currentColor" opacity="0.85" />
          {[13, 23].map((y) => (
            <g key={y}>
              {line(4, y, 9, 0.75)}
              {line(19, y, 7, 0.6)}
              {line(4, y + 3, 18)}
              {line(4, y + 5.5, 20)}
              {line(4, y + 8, 14)}
            </g>
          ))}
        </>
      )}
      {id === 'banner' && (
        <>
          <rect x="0.5" y="0.5" width="29" height="9" rx="1.5" fill="currentColor" opacity="0.12" />
          {line(3.5, 3.5, 11, 0.9)}
          {line(3.5, 6, 8, 0.35)}
          {line(19, 3, 7.5, 0.4)}
          {line(21, 5.2, 5.5, 0.4)}
          {[13, 24].map((y) => (
            <g key={y}>
              {line(3.5, y, 23, 0.7)}
              {line(3.5, y + 3, 9, 0.6)}
              {line(3.5, y + 5.5, 21)}
              {line(3.5, y + 8, 17)}
            </g>
          ))}
        </>
      )}
      {id === 'elegant' && (
        <>
          <rect x="3.5" y="3.5" width="7" height="7" rx="0.6" fill="currentColor" opacity="0.18" />
          {line(13, 4, 13, 0.9)}
          {line(13, 6.8, 9, 0.6)}
          {line(13, 9.2, 10, 0.3)}
          {[14, 25].map((y) => (
            <g key={y}>
              {line(3.5, y, 10, 0.75)}
              <rect x="3.5" y={y + 1.8} width="23" height="0.6" fill="currentColor" opacity="0.6" />
              {line(3.5, y + 4, 21)}
              {line(3.5, y + 6.5, 22)}
            </g>
          ))}
        </>
      )}
      {id === 'dense' && (
        <>
          {line(3, 3, 8, 0.9)}
          {line(3, 5.4, 22, 0.3)}
          {line(3, 7.4, 16, 0.5)}
          <rect x="3" y="10" width="11" height="1.2" rx="0.5" fill="currentColor" opacity="0.75" />
          <rect x="3" y="11.6" width="24" height="0.5" fill="currentColor" opacity="0.6" />
          {[13.5, 25].map((y) => (
            <g key={y}>
              <rect x="3" y={y} width="24" height="2.6" rx="0.6" fill="currentColor" opacity="0.14" />
              <rect x="3" y={y} width="0.9" height="2.6" fill="currentColor" opacity="0.7" />
              {line(3.5, y + 4, 23)}
              {line(3.5, y + 6, 22)}
              {line(3.5, y + 8, 23)}
            </g>
          ))}
        </>
      )}
      {id === 'airy' && (
        <>
          <rect x="4" y="4" width="13" height="2.6" rx="1" fill="currentColor" opacity="0.9" />
          {line(4, 9, 18, 0.3)}
          {[15, 25].map((y) => (
            <g key={y}>
              {line(4, y, 5, 0.7)}
              {line(12, y, 14)}
              {line(12, y + 2.5, 12)}
              {line(12, y + 5, 14)}
            </g>
          ))}
        </>
      )}
      {id === 'academic' && (
        <>
          {line(9, 4, 12, 0.9)}
          {line(8, 7.5, 14, 0.3)}
          {[12, 23].map((y) => (
            <g key={y}>
              {line(4, y, 22, 0.75)}
              {line(4, y + 1.6, 22, 0.75)}
              {line(5, y + 4.5, 19)}
              {line(5, y + 7, 17)}
            </g>
          ))}
        </>
      )}
      {id === 'compact' && (
        <>
          {line(3, 3.5, 9, 0.9)}
          {line(16, 3.5, 11, 0.3)}
          {line(3, 6.5, 24, 0.8)}
          {[9, 17, 25, 33].map((y) => (
            <g key={y}>
              <rect x="3" y={y} width="24" height="2" fill="currentColor" opacity="0.15" />
              {line(3, y + 3.5, 22)}
              {line(3, y + 5.5, 20)}
            </g>
          ))}
        </>
      )}
      {id === 'sidebar' && (
        <>
          <rect x="0.5" y="0.5" width="10" height="39" rx="1.5" fill="currentColor" opacity="0.1" />
          {line(2.5, 4, 6, 0.9)}
          {line(2.5, 8, 6)}
          {line(2.5, 10, 5)}
          {line(2.5, 16, 6)}
          {line(2.5, 18, 5)}
          {[4, 16, 27].map((y) => (
            <g key={y}>
              {line(13, y, 13, 0.7)}
              {line(13, y + 2.6, 13)}
              {line(13, y + 4.8, 11)}
            </g>
          ))}
        </>
      )}
    </svg>
  )
}
