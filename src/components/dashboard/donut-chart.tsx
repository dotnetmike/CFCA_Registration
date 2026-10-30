export type DonutSegment = { key: string; value: number; color: string }

type DonutChartProps = {
  segments: DonutSegment[]
  /** Value representing the full circle; defaults to the sum of the segments. */
  total?: number
  centerValue: string | number
  centerLabel: string
  ariaLabel: string
  trackColor?: string
  className?: string
}

const RADIUS = 52
const STROKE = 20
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export const DonutChart = ({
  segments,
  total,
  centerValue,
  centerLabel,
  ariaLabel,
  trackColor = "#cfd8e3",
  className = "h-36 w-36",
}: DonutChartProps) => {
  const fullCircle = total ?? segments.reduce((sum, segment) => sum + segment.value, 0)
  const starts = segments.reduce<number[]>((acc, segment, index) => [...acc, acc[index] + segment.value], [0])
  return (
    <div className={`relative shrink-0 ${className}`}>
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" role="img" aria-label={ariaLabel}>
        <circle cx="70" cy="70" r={RADIUS} fill="none" stroke={trackColor} strokeWidth={STROKE} />
        {fullCircle > 0
          ? segments.map((segment, index) =>
              segment.value > 0 ? (
                <circle
                  key={segment.key}
                  cx="70"
                  cy="70"
                  r={RADIUS}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={STROKE}
                  strokeDasharray={`${(segment.value / fullCircle) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                  strokeDashoffset={-(starts[index] / fullCircle) * CIRCUMFERENCE}
                />
              ) : null
            )
          : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-semibold tabular-nums text-ink">{centerValue}</span>
        <span className="text-xs text-ink-soft">{centerLabel}</span>
      </div>
    </div>
  )
}
