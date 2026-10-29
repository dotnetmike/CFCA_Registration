import { AUSTRALIA_STATE_PATHS } from "@/lib/dashboard/australia-states-map"
import {
  buildStateHeadcounts,
  formatHeadcountAsOf,
} from "@/lib/dashboard/state-headcount"
import type { ReportsSummary } from "@/lib/dashboard/reports-cache"

type StateHeadcountMapProps = {
  summary: ReportsSummary
  asOf: number
}

type Callout = { x: number; y: number }

const CALLOUT_WIDTH = 150
const CALLOUT_HEIGHT = 104
const CALLOUT_HEADER_HEIGHT = 38
const CALLOUT_RADIUS = 12
const VIEWBOX = "-250 -140 1500 1130"
const HEADER_GRADIENT_ID = "state-headcount-callout-header"

// Top-left corner of each state's callout box, in map coordinates (map spans 0–1000 × 0–943).
const CALLOUTS: Record<string, Callout> = {
  NT: { x: 430, y: -132 },
  WA: { x: -235, y: 330 },
  SA: { x: 290, y: 808 },
  QLD: { x: 1070, y: 250 },
  NSW: { x: 1070, y: 500 },
  ACT: { x: 1070, y: 660 },
  VIC: { x: 490, y: 878 },
  TAS: { x: 1000, y: 826 },
}

const BRAND_DARK = "#0b2a7a"
const BRAND_LINE = "#1b3f9e"
const EMPTY_FILL = "#dbe5f7"
const LIGHT_FILL = [157, 184, 236]
const DARK_FILL = [11, 42, 122]

const fillForCount = (count: number, max: number) => {
  if (count <= 0 || max <= 0) return EMPTY_FILL
  const intensity = Math.sqrt(count / max)
  const channel = (index: number) =>
    Math.round(LIGHT_FILL[index] + (DARK_FILL[index] - LIGHT_FILL[index]) * intensity)
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`
}

const leaderStart = (callout: Callout, anchor: [number, number]): [number, number] => {
  const centerX = callout.x + CALLOUT_WIDTH / 2
  const centerY = callout.y + CALLOUT_HEIGHT / 2
  const dx = anchor[0] - centerX
  const dy = anchor[1] - centerY
  if (Math.abs(dx) / CALLOUT_WIDTH > Math.abs(dy) / CALLOUT_HEIGHT) {
    return [dx > 0 ? callout.x + CALLOUT_WIDTH : callout.x, centerY]
  }
  return [centerX, dy > 0 ? callout.y + CALLOUT_HEIGHT : callout.y]
}

const calloutHeaderPath = ({ x, y }: Callout) => {
  const right = x + CALLOUT_WIDTH
  const bottom = y + CALLOUT_HEADER_HEIGHT
  const r = CALLOUT_RADIUS
  return `M${x} ${bottom}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}H${right - r}A${r} ${r} 0 0 1 ${right} ${y + r}V${bottom}Z`
}

const IconGroup = () => (
  <svg viewBox="0 0 24 24" className="h-12 w-12 shrink-0" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="7" r="3.2" />
    <path d="M6 20v-2.5A4.5 4.5 0 0 1 10.5 13h3a4.5 4.5 0 0 1 4.5 4.5V20Z" />
    <circle cx="5" cy="9" r="2.4" opacity="0.75" />
    <path d="M0.5 19v-1.8A3.4 3.4 0 0 1 3.9 14h2a5.8 5.8 0 0 0-1.4 3.5V19Z" opacity="0.75" />
    <circle cx="19" cy="9" r="2.4" opacity="0.75" />
    <path d="M23.5 19v-1.8a3.4 3.4 0 0 0-3.4-3.2h-2a5.8 5.8 0 0 1 1.4 3.5V19Z" opacity="0.75" />
  </svg>
)

export const StateHeadcountMap = ({ summary, asOf }: StateHeadcountMapProps) => {
  const report = buildStateHeadcounts(summary)
  const maxAdults = Math.max(0, ...report.states.map((row) => row.adults))
  const asOfLabel = formatHeadcountAsOf(asOf)
  const mapLabel = `Map of Australia showing adult registrations per state as of ${asOfLabel}: ${report.states
    .map((row) => `${row.state} ${row.adults}`)
    .join(", ")}. Total ${report.total}.`

  return (
    <section
      className="cfca-section-panel relative overflow-hidden bg-white"
      aria-labelledby="state-headcount-title"
    >
      <div className="relative z-10 px-2 pb-6 pt-4 sm:px-6 sm:pb-8">
        <header className="flex flex-col gap-3 px-3 pb-2 sm:flex-row sm:items-start sm:justify-between lg:absolute lg:inset-x-0 lg:top-0 lg:px-6 lg:pb-0 lg:pt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/cfca-logo-official.jpg"
            alt="Couples for Christ Australia (Established August 1988)"
            width={1088}
            height={403}
            className="h-20 w-auto self-start object-contain sm:h-24 lg:h-28 xl:h-32"
          />
          <div
            id="state-headcount-title"
            className="self-end bg-gradient-to-br from-[#2f5fd0] via-[#1b3f9e] to-[#0b2a7a] px-7 py-3 text-right text-white shadow-md [clip-path:polygon(3%_6%,100%_0,98%_94%,0_100%)] sm:self-start lg:px-9"
          >
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white/85 lg:text-xs">
              CFCA National Conference 2027
            </p>
            <h3 className="font-display text-xl font-bold leading-tight lg:text-2xl">
              Current Registration Headcount
            </h3>
            <p className="text-base font-bold uppercase tracking-[0.3em] lg:text-lg">Per State</p>
          </div>
        </header>

        <svg
          viewBox={VIEWBOX}
          className="mx-auto block h-auto w-full max-w-4xl"
          role="img"
          aria-label={mapLabel}
        >
          <defs>
            <linearGradient id={HEADER_GRADIENT_ID} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2f5fd0" />
              <stop offset="100%" stopColor={BRAND_LINE} />
            </linearGradient>
          </defs>
          {report.states.map(({ state, adults }) => {
            const shape = AUSTRALIA_STATE_PATHS[state]
            if (!shape) return null
            return (
              <path
                key={state}
                d={shape.d}
                fill={fillForCount(adults, maxAdults)}
                stroke="#ffffff"
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
            )
          })}

          {report.states.map(({ state, adults }) => {
            const shape = AUSTRALIA_STATE_PATHS[state]
            const callout = CALLOUTS[state]
            if (!shape || !callout) return null
            const [startX, startY] = leaderStart(callout, shape.anchor)
            return (
              <g key={state} aria-hidden="true">
                <line
                  x1={startX}
                  y1={startY}
                  x2={shape.anchor[0]}
                  y2={shape.anchor[1]}
                  stroke={BRAND_LINE}
                  strokeWidth={2.5}
                />
                <circle
                  cx={shape.anchor[0]}
                  cy={shape.anchor[1]}
                  r={7}
                  fill="#ffffff"
                  stroke={BRAND_LINE}
                  strokeWidth={3}
                />
                <rect
                  x={callout.x}
                  y={callout.y}
                  width={CALLOUT_WIDTH}
                  height={CALLOUT_HEIGHT}
                  rx={CALLOUT_RADIUS}
                  fill="#ffffff"
                />
                <path d={calloutHeaderPath(callout)} fill={`url(#${HEADER_GRADIENT_ID})`} />
                <rect
                  x={callout.x}
                  y={callout.y}
                  width={CALLOUT_WIDTH}
                  height={CALLOUT_HEIGHT}
                  rx={CALLOUT_RADIUS}
                  fill="none"
                  stroke={BRAND_LINE}
                  strokeWidth={3}
                />
                <text
                  x={callout.x + CALLOUT_WIDTH / 2}
                  y={callout.y + 28}
                  textAnchor="middle"
                  fontSize={25}
                  fontWeight={800}
                  letterSpacing={2}
                  fill="#ffffff"
                >
                  {state}
                </text>
                <text
                  x={callout.x + CALLOUT_WIDTH / 2}
                  y={callout.y + 90}
                  textAnchor="middle"
                  fontSize={50}
                  fontWeight={800}
                  fill={BRAND_DARK}
                >
                  {adults}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="mx-auto mt-2 w-fit text-[#0b2a7a] lg:absolute lg:bottom-8 lg:left-6 lg:mt-0">
          <div className="overflow-hidden rounded-xl border-[3px] border-[#1b3f9e] bg-white shadow-md">
            <p className="bg-gradient-to-br from-[#2f5fd0] to-[#1b3f9e] px-4 py-1.5 text-center text-sm font-extrabold uppercase tracking-[0.08em] text-white">
              Total registrations
            </p>
            <div className="flex items-center gap-3 px-4 py-2">
              <IconGroup />
              <div className="text-center">
                <p className="text-5xl font-extrabold leading-none tabular-nums lining-nums">
                  {report.total}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-[#1b3f9e]">(Adult count only)</p>
              </div>
            </div>
            <p className="border-t border-[#1b3f9e]/20 px-4 py-1.5 text-center text-xs font-semibold">
              as of <time dateTime={new Date(asOf).toISOString()}>{asOfLabel}</time>
            </p>
            {report.unassigned > 0 ? (
              <p className="px-4 pb-1.5 text-center text-xs text-ink-soft">
                Includes {report.unassigned} with no state recorded
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <svg
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-20 w-full"
        aria-hidden="true"
      >
        <path d="M0 70 C200 30 400 110 600 70 S1000 30 1200 70 V120 H0Z" fill="#e3ebfa" />
        <path d="M0 90 C250 60 450 120 700 90 S1050 60 1200 92 V120 H0Z" fill="#cddbf5" />
      </svg>

      <ul className="sr-only">
        {report.states.map(({ state, adults }) => (
          <li key={state}>
            {state}: {adults} adults
          </li>
        ))}
      </ul>
    </section>
  )
}
