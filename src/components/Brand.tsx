import { Link } from 'react-router'

/** 品牌图标：木质的文档小方块 */
export function BrandMark({ size = 30, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/brand/icon-64.png"
      srcSet="/brand/icon-64.png 1x, /brand/icon-128.png 2x, /brand/icon-256.png 4x"
      width={size}
      height={size}
      alt=""
      draggable={false}
      className={`select-none drop-shadow-[0_4px_6px_rgb(17_17_17/0.12)] ${className}`}
    />
  )
}

/** 品牌标识：图标 + 衬线字标。落地页与工作台共用 */
export function Brand({ to = '/', compact }: { to?: string; compact?: boolean }) {
  return (
    <Link to={to} className="group flex shrink-0 items-center gap-2.5" aria-label="拾历 首页">
      <BrandMark size={30} className="transition-transform duration-300 group-hover:-rotate-3" />
      <span className={`whitespace-nowrap text-[19px] font-semibold tracking-[0.08em] text-ink ${compact ? 'hidden sm:inline' : ''}`}>拾历</span>
    </Link>
  )
}
