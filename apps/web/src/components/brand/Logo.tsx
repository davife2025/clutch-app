/**
 * Clutch logo mark — the "cradle bracket".
 *
 * A bracket holding an asset. Reads as a clutch (pocket holding something),
 * the brand metaphor. Negative space tells the story without a wordmark.
 *
 * Sizes:
 *   - 16-20px: favicon, dense UI
 *   - 36-40px: sidebar header, app chrome
 *   - 56-80px: marketing hero, splash
 */
export function Logo({
  size = 36,
  className = '',
  variant = 'default',
}: {
  size?: number
  className?: string
  /** "default" = gold on ink. "inverse" = ink on gold. "outline" = stroke only. */
  variant?: 'default' | 'inverse' | 'outline'
}) {
  const colors = {
    default: { bg: '#C8A968', stroke: '#0F1014', fill: '#0F1014' }, // gold pill, ink mark
    inverse: { bg: 'transparent', stroke: '#C8A968', fill: '#C8A968' }, // gold mark on whatever bg
    outline: { bg: 'transparent', stroke: '#F1ECE0', fill: '#F1ECE0' }, // cream mark on ink
  }[variant]

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Clutch"
    >
      {variant === 'default' && <rect width="100" height="100" rx="22" fill={colors.bg} />}
      {/* Bracket — the cradle, held open at the top */}
      <path
        d="M 28 28 L 28 62 Q 28 72 38 72 L 62 72 Q 72 72 72 62 L 72 28"
        stroke={colors.stroke}
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Asset — the thing being held */}
      <rect x="42" y="38" width="16" height="16" rx="3" fill={colors.fill} />
    </svg>
  )
}
