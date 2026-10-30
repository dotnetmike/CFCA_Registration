"use client"

import { useState } from "react"
import { AUSTRALIA_STATE_PATHS } from "@/lib/dashboard/australia-states-map"
import {
  ALL_SELECTABLE_BANDS,
  bandsForSelection,
  buildStateHeadcounts,
  formatHeadcountAsOf,
  headcountForSelection,
  isEveryoneSelected,
  toggleHeadcountBand,
  type HeadcountBand,
  type HeadcountBreakdown,
  type HeadcountSelection,
  type SelectableBandKey,
} from "@/lib/dashboard/state-headcount"
import type { ReportsSummary } from "@/lib/dashboard/reports-cache"

type StateHeadcountMapProps = {
  summary: ReportsSummary
  asOf: number
}

type Callout = { x: number; y: number }

type CalloutLayout = {
  viewBox: string
  width: number
  height: number
  svgClassName: string
  callouts: Record<string, Callout>
}

const CALLOUT_HEADER_HEIGHT = 38
const CALLOUT_ROW_HEIGHT = 26
const CALLOUT_BODY_PADDING = 12
const CALLOUT_NUMBER_COLUMN = 84
const CALLOUT_RADIUS = 12
const HEADER_GRADIENT_ID = "state-headcount-callout-header"

// Callout positions are the top-left corner of each card, in map coordinates (map spans 0–1000 × 0–943).
const SINGLE_LAYOUT: CalloutLayout = {
  viewBox: "-250 -140 1500 1130",
  width: 150,
  height: 104,
  svgClassName: "max-w-4xl",
  callouts: {
    NT: { x: 430, y: -132 },
    WA: { x: -235, y: 330 },
    SA: { x: 290, y: 808 },
    QLD: { x: 1070, y: 250 },
    NSW: { x: 1070, y: 500 },
    ACT: { x: 1070, y: 660 },
    VIC: { x: 490, y: 878 },
    TAS: { x: 1000, y: 826 },
  },
}

const DETAILED_CALLOUTS: Record<string, Callout> = {
  NT: { x: 380, y: -132 },
  WA: { x: -280, y: 300 },
  SA: { x: 200, y: 790 },
  QLD: { x: 1075, y: 220 },
  NSW: { x: 1075, y: 460 },
  ACT: { x: 1075, y: 630 },
  VIC: { x: 465, y: 845 },
  TAS: { x: 1010, y: 820 },
}

const detailedLayout = (rowCount: number): CalloutLayout => ({
  viewBox: `-290 -140 1630 ${1135 + (rowCount - 3) * CALLOUT_ROW_HEIGHT}`,
  width: 250,
  height: CALLOUT_HEADER_HEIGHT + rowCount * CALLOUT_ROW_HEIGHT + CALLOUT_BODY_PADDING * 2,
  svgClassName: "max-w-5xl",
  callouts: DETAILED_CALLOUTS,
})

const FILTER_OPTIONS: { key: SelectableBandKey; label: string }[] = [
  { key: "adults", label: "Adults (18+)" },
  { key: "children", label: "Kids (2–11)" },
  { key: "teens", label: "Teens (12–17)" },
]

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

const leaderStart = (callout: Callout, layout: CalloutLayout, anchor: [number, number]): [number, number] => {
  const centerX = callout.x + layout.width / 2
  const centerY = callout.y + layout.height / 2
  const dx = anchor[0] - centerX
  const dy = anchor[1] - centerY
  if (Math.abs(dx) / layout.width > Math.abs(dy) / layout.height) {
    return [dx > 0 ? callout.x + layout.width : callout.x, centerY]
  }
  return [centerX, dy > 0 ? callout.y + layout.height : callout.y]
}

const calloutHeaderPath = ({ x, y }: Callout, width: number) => {
  const right = x + width
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

const describeBreakdown = (breakdown: HeadcountBreakdown, bands: HeadcountBand[]) =>
  bands.map((band) => `${band.label} ${breakdown[band.key]}`).join(", ")

type CalloutCardProps = {
  state: string
  count: number
  breakdown: HeadcountBreakdown
  bands: HeadcountBand[]
  isSingle: boolean
  callout: Callout
  layout: CalloutLayout
  anchor: [number, number]
}

const CalloutCard = ({ state, count, breakdown, bands, isSingle, callout, layout, anchor }: CalloutCardProps) => {
  const [startX, startY] = leaderStart(callout, layout, anchor)
  const bodyTop = callout.y + CALLOUT_HEADER_HEIGHT
  const bodyCenterY = bodyTop + (layout.height - CALLOUT_HEADER_HEIGHT) / 2
  const dividerX = callout.x + CALLOUT_NUMBER_COLUMN
  return (
    <g aria-hidden="true">
      <line x1={startX} y1={startY} x2={anchor[0]} y2={anchor[1]} stroke={BRAND_LINE} strokeWidth={2.5} />
      <circle cx={anchor[0]} cy={anchor[1]} r={7} fill="#ffffff" stroke={BRAND_LINE} strokeWidth={3} />
      <rect
        x={callout.x}
        y={callout.y}
        width={layout.width}
        height={layout.height}
        rx={CALLOUT_RADIUS}
        fill="#ffffff"
      />
      <path d={calloutHeaderPath(callout, layout.width)} fill={`url(#${HEADER_GRADIENT_ID})`} />
      <rect
        x={callout.x}
        y={callout.y}
        width={layout.width}
        height={layout.height}
        rx={CALLOUT_RADIUS}
        fill="none"
        stroke={BRAND_LINE}
        strokeWidth={3}
      />
      <text
        x={callout.x + layout.width / 2}
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
        x={isSingle ? callout.x + layout.width / 2 : callout.x + CALLOUT_NUMBER_COLUMN / 2}
        y={bodyCenterY + 17}
        textAnchor="middle"
        fontSize={50}
        fontWeight={800}
        fill={BRAND_DARK}
      >
        {count}
      </text>
      {isSingle ? null : (
        <>
          <line
            x1={dividerX}
            y1={bodyTop + CALLOUT_BODY_PADDING}
            x2={dividerX}
            y2={callout.y + layout.height - CALLOUT_BODY_PADDING}
            stroke={BRAND_LINE}
            strokeOpacity={0.25}
            strokeWidth={2}
          />
          {bands.map((band, index) => {
            const baseline = bodyTop + CALLOUT_BODY_PADDING + CALLOUT_ROW_HEIGHT * index + 19
            return (
              <g key={band.key}>
                <text x={dividerX + 12} y={baseline} fontSize={19} fontWeight={600} fill={BRAND_LINE}>
                  {band.label}
                </text>
                <text
                  x={callout.x + layout.width - 14}
                  y={baseline}
                  textAnchor="end"
                  fontSize={20}
                  fontWeight={800}
                  fill={BRAND_DARK}
                >
                  {breakdown[band.key]}
                </text>
              </g>
            )
          })}
        </>
      )}
    </g>
  )
}

export const StateHeadcountMap = ({ summary, asOf }: StateHeadcountMapProps) => {
  const [selection, setSelection] = useState<HeadcountSelection>(ALL_SELECTABLE_BANDS)

  const report = buildStateHeadcounts(summary)
  const bands = bandsForSelection(report.total, selection)
  const isEveryone = isEveryoneSelected(selection)
  const isSingle = selection.length === 1
  const layout = isSingle ? SINGLE_LAYOUT : detailedLayout(bands.length)
  const counts = report.states.map((row) => ({ ...row, count: headcountForSelection(row, selection) }))
  const totalCount = headcountForSelection(report.total, selection)
  const unassignedCount = headcountForSelection(report.unassigned, selection)
  const maxCount = Math.max(0, ...counts.map((row) => row.count))
  const asOfLabel = formatHeadcountAsOf(asOf)
  const selectionLabel = isEveryone ? "all registered attendees" : bands.map((band) => band.label).join(" and ")
  const mapLabel = `Map of Australia showing ${selectionLabel} per state as of ${asOfLabel}: ${counts
    .map((row) => `${row.state} ${row.count}`)
    .join(", ")}. Total ${totalCount}.`

  const handleToggleBand = (key: SelectableBandKey) =>
    setSelection((current) => toggleHeadcountBand(current, key))

  return (
    <div className="space-y-3">
      <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-[color:var(--line)] bg-white px-4 py-3">
        <legend className="sr-only">Choose who to include in the headcount report</legend>
        <span className="text-sm font-semibold text-ink" aria-hidden="true">
          Show:
        </span>
        {FILTER_OPTIONS.map((option) => {
          const isChecked = selection.includes(option.key)
          const isLastChecked = isChecked && selection.length === 1
          return (
            <label
              key={option.key}
              className="flex cursor-pointer items-center gap-2 text-sm text-ink has-[:disabled]:cursor-not-allowed"
              title={isLastChecked ? "At least one group must stay selected" : undefined}
            >
              <input
                type="checkbox"
                className="h-4 w-4 cursor-pointer accent-[#1b3f9e] disabled:cursor-not-allowed"
                checked={isChecked}
                disabled={isLastChecked}
                onChange={() => handleToggleBand(option.key)}
                aria-label={`Show ${option.label}`}
              />
              {option.label}
            </label>
          )
        })}
      </fieldset>

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
            viewBox={layout.viewBox}
            className={`mx-auto block h-auto w-full ${layout.svgClassName}`}
            role="img"
            aria-label={mapLabel}
          >
            <defs>
              <linearGradient id={HEADER_GRADIENT_ID} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#2f5fd0" />
                <stop offset="100%" stopColor={BRAND_LINE} />
              </linearGradient>
            </defs>
            {counts.map(({ state, count }) => {
              const shape = AUSTRALIA_STATE_PATHS[state]
              if (!shape) return null
              return (
                <path
                  key={state}
                  d={shape.d}
                  fill={fillForCount(count, maxCount)}
                  stroke="#ffffff"
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                />
              )
            })}

            {counts.map((row) => {
              const shape = AUSTRALIA_STATE_PATHS[row.state]
              const callout = layout.callouts[row.state]
              if (!shape || !callout) return null
              return (
                <CalloutCard
                  key={row.state}
                  state={row.state}
                  count={row.count}
                  breakdown={row}
                  bands={bands}
                  isSingle={isSingle}
                  callout={callout}
                  layout={layout}
                  anchor={shape.anchor}
                />
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
                {isSingle ? (
                  <div className="text-center">
                    <p className="text-5xl font-extrabold leading-none tabular-nums lining-nums">{totalCount}</p>
                    <p className="mt-0.5 text-xs font-semibold text-[#1b3f9e]">({bands[0].note})</p>
                  </div>
                ) : (
                  <>
                    <p className="text-5xl font-extrabold leading-none tabular-nums lining-nums">{totalCount}</p>
                    <dl className="ml-1 border-l border-[#1b3f9e]/25 pl-3 text-xs">
                      {bands.map((band) => (
                        <div key={band.key} className="flex justify-between gap-4 py-px">
                          <dt className="font-semibold text-[#1b3f9e]">{band.label}</dt>
                          <dd className="font-extrabold tabular-nums">{report.total[band.key]}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                )}
              </div>
              <p className="border-t border-[#1b3f9e]/20 px-4 py-1.5 text-center text-xs font-semibold">
                as of <time dateTime={new Date(asOf).toISOString()}>{asOfLabel}</time>
              </p>
              {unassignedCount > 0 ? (
                <p className="px-4 pb-1.5 text-center text-xs text-ink-soft">
                  Includes {unassignedCount} with no state recorded
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
          {counts.map((row) => (
            <li key={row.state}>
              {row.state}: {row.count} ({describeBreakdown(row, bands)})
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
