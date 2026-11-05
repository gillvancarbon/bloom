import { useId } from 'react'

/**
 * A "frozen flame" — a solid flame with a snowflake carved out of it, so it
 * reads as fire that has iced over. Drawn with `currentColor` and a mask, so
 * the snowflake shows whatever is behind it and the glyph works on any disc.
 */

/** A simple solid flame silhouette. */
const FLAME =
  'M12 2.2c.6 2.1 2 3.4 3.2 5C16.6 8.9 18 10.9 18 13.2a6 6 0 0 1-12 0c0-1.7.7-3.3 1.8-4.7.3 1.1 1 1.9 1.9 2.3-.7-3.1.2-6.3 2.3-8.6Z'

/** One arm of the snowflake, rotated to make a six-point star. */
function snowflakeArm(cx: number, cy: number, length: number, angle: number, key: number) {
  const half = length / 2
  return (
    <line
      key={key}
      x1={cx}
      y1={cy - half}
      x2={cx}
      y2={cy + half}
      transform={`rotate(${angle} ${cx} ${cy})`}
    />
  )
}

export function FrozenFlame({ className = 'h-4 w-4' }: { className?: string }) {
  // useId can contain ":", which is awkward inside url(#…).
  const maskId = `frozen-flame-${useId().replace(/:/g, '')}`
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <defs>
        <mask id={maskId}>
          <rect width="24" height="24" fill="black" />
          <path d={FLAME} fill="white" />
          <g stroke="black" strokeWidth="1.7" strokeLinecap="round">
            {[0, 60, 120].map((angle, i) => snowflakeArm(12, 13.8, 7.2, angle, i))}
          </g>
        </mask>
      </defs>
      <rect width="24" height="24" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  )
}
