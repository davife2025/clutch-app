/**
 * Clutch logo — shield + coin.
 *
 * A shield containing a coin. The metaphor matches the brand directly:
 * the wallet (coin) is contained by the protection layer (shield).
 * "Wallets your AI won't drain."
 *
 * Three variants:
 *   - default: gold shield on ink, ink coin cutout, gold $ inside
 *   - inverse: ink shield on gold pill (for light surfaces)
 *   - outline: cream stroke only, transparent fill (utility uses)
 *
 * Sizes:
 *   - 16-20px: favicon, dense UI
 *   - 36-40px: app chrome, sidebar
 *   - 56-80px: marketing hero
 */
export function Logo({
  size = 36,
  className = '',
  variant = 'default',
}: {
  size?: number
  className?: string
  variant?: 'default' | 'inverse' | 'outline'
}) {
  if (variant === 'inverse') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className={className}
        role="img"
        aria-label="Clutch"
      >
        <rect width="100" height="100" rx="22" fill="#C8A968" />
        <ShieldPath fill="#0F1014" />
        <CoinHole fill="#C8A968" stroke="#0F1014" />
        <DollarMark fill="#0F1014" />
      </svg>
    )
  }

  if (variant === 'outline') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className={className}
        role="img"
        aria-label="Clutch"
      >
        <ShieldPath fill="none" stroke="#F1ECE0" strokeWidth={3} />
        <DollarMark fill="#F1ECE0" />
      </svg>
    )
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Clutch"
    >
      <rect width="100" height="100" rx="22" fill="#0F1014" />
      <ShieldPath fill="#C8A968" />
      <CoinHole fill="#0F1014" stroke="#C8A968" />
      <DollarMark fill="#C8A968" />
    </svg>
  )
}

function ShieldPath({
  fill,
  stroke,
  strokeWidth = 0,
}: {
  fill: string
  stroke?: string
  strokeWidth?: number
}) {
  return (
    <path
      d="M 50 22 L 28 28 L 28 52 Q 28 70 50 80 Q 72 70 72 52 L 72 28 Z"
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
  )
}

function CoinHole({ fill, stroke }: { fill: string; stroke: string }) {
  return <circle cx="50" cy="50" r="13" fill={fill} stroke={stroke} strokeWidth="1.5" />
}

function DollarMark({ fill }: { fill: string }) {
  return (
    <path
      d="M 50 41.5 L 50 58.5 M 53.5 44 Q 53.5 42 50 42 Q 46.5 42 46.5 45 Q 46.5 47 50 48 Q 53.5 49 53.5 51 Q 53.5 54 50 54 Q 46.5 54 46.5 52"
      fill="none"
      stroke={fill}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}
