"use client"

import { Button } from "@/components/ui/button"
import { DonutChart } from "@/components/dashboard/donut-chart"
import { StatCard } from "@/components/dashboard/stat-card"
import { formatCalendarDate } from "@/components/reconciliation/format"
import { downloadTextFile } from "@/lib/dashboard/download-csv"
import {
  buildEarlyBirdCsv,
  earlyBirdStateBars,
  isPoolNearlyFull,
  niceAxis,
  percentOf,
  poolSegments,
  summarizeEarlyBird,
} from "@/lib/dashboard/early-bird-report"
import type { EarlyBirdPool, EarlyBirdUsage } from "@/lib/dashboard/reports-cache"
import { cn } from "@/lib/utils"

const COLOR_CONFIRMED = "#1565c0"
const COLOR_AWAITING = "#f5b82e"
const COLOR_UNALLOCATED = "#cfd8e3"

const POOL_TITLES: Record<EarlyBirdPool["id"], string> = {
  melbourne: "Victoria",
  interstate: "Interstate · Shared capacity",
}

const IconUsers = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const IconClock = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)

const IconTarget = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4" />
  </svg>
)

const IconDownload = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M12 4v11" />
    <path d="m7 10 5 5 5-5" />
    <path d="M5 20h14" />
  </svg>
)

const IconInfo = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="currentColor" aria-hidden="true">
    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z" />
  </svg>
)

const LegendRow = ({ color, label, value }: { color: string; label: string; value: number }) => (
  <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
    <span className="flex items-center gap-2 text-ink">
      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      {label}
    </span>
    <span className="font-semibold tabular-nums text-ink">{value}</span>
  </div>
)

const PoolPanel = ({ pool }: { pool: EarlyBirdPool }) => {
  const segments = poolSegments(pool)
  const isNearlyFull = isPoolNearlyFull(pool)
  return (
    <div className="flex flex-col rounded-2xl border border-[color:var(--line)] bg-white">
      <h4 className="px-5 pt-4 font-display text-lg font-semibold text-ink">{POOL_TITLES[pool.id] ?? pool.label}</h4>
      <div className="flex flex-1 flex-col items-center gap-5 px-5 py-4 sm:flex-row">
        <DonutChart
          segments={[
            { key: "confirmed", value: segments.confirmed, color: COLOR_CONFIRMED },
            { key: "awaiting", value: segments.awaiting, color: COLOR_AWAITING },
          ]}
          total={pool.capacity}
          centerValue={pool.used}
          centerLabel="confirmed"
          trackColor={COLOR_UNALLOCATED}
          ariaLabel={`${pool.label}: ${pool.used} confirmed, ${pool.reserved} awaiting payment, ${segments.unallocated} unallocated of ${pool.capacity}`}
        />
        <div className="w-full flex-1">
          <LegendRow color={COLOR_CONFIRMED} label="Confirmed" value={pool.used} />
          <LegendRow color={COLOR_AWAITING} label="Awaiting payment" value={pool.reserved} />
          <LegendRow color={COLOR_UNALLOCATED} label="Unallocated" value={segments.unallocated} />
          <div className="mt-2 flex items-center justify-between border-t border-[color:var(--line)] pt-2 text-sm">
            <span className="text-ink-soft">Total capacity</span>
            <span className="font-semibold tabular-nums text-ink">{pool.capacity}</span>
          </div>
        </div>
      </div>
      <div className="mx-3 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-mist/60 px-4 py-2 text-sm">
        <span className={cn("font-semibold", isNearlyFull ? "text-[color:var(--danger)]" : "text-ink")}>
          {pool.remaining} remaining against paid capacity
        </span>
        <span className="text-ink-soft">{percentOf(pool.used, pool.capacity)}% confirmed</span>
      </div>
    </div>
  )
}

const StateBars = ({ earlyBird }: { earlyBird: EarlyBirdUsage }) => {
  const bars = earlyBirdStateBars(earlyBird)
  const axis = niceAxis(Math.max(0, ...bars.map((row) => row.total)))
  const widthOf = (value: number) => `${(value / axis.max) * 100}%`
  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-white px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="font-display text-lg font-semibold text-ink">Early bird adults by state</h4>
        <div className="flex items-center gap-4 text-xs text-ink-soft">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR_CONFIRMED }} aria-hidden="true" />
            Paid / confirmed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR_AWAITING }} aria-hidden="true" />
            Reserved / unpaid
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[3rem_1fr_3rem] items-center gap-x-3 gap-y-1.5 text-sm">
        <span />
        <span />
        <span className="text-right text-xs font-semibold text-ink-soft">Total</span>
        {bars.map((row) => (
          <div key={row.state} className="contents">
            <span className="font-semibold text-ink">{row.state}</span>
            <div className="relative h-5">
              <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                {axis.ticks.map((tick) => (
                  <span
                    key={tick}
                    className="absolute inset-y-[-3px] w-px bg-[color:var(--line)]"
                    style={{ left: widthOf(tick) }}
                  />
                ))}
              </div>
              {row.total === 0 ? (
                <span className="relative text-xs text-ink-soft">0</span>
              ) : (
                <div
                  className="relative flex h-full"
                  role="img"
                  aria-label={`${row.state}: ${row.confirmed} paid, ${row.reserved} reserved`}
                >
                  {row.confirmed > 0 ? (
                    <div
                      className="flex h-full items-center justify-center rounded-l text-[0.7rem] font-semibold text-white last:rounded-r"
                      style={{ width: widthOf(row.confirmed), backgroundColor: COLOR_CONFIRMED }}
                    >
                      {row.confirmed}
                    </div>
                  ) : null}
                  {row.reserved > 0 ? (
                    <div
                      className="flex h-full items-center justify-center rounded-r text-[0.7rem] font-semibold text-ink first:rounded-l"
                      style={{ width: widthOf(row.reserved), backgroundColor: COLOR_AWAITING }}
                    >
                      {row.reserved}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
            <span className="text-right font-semibold tabular-nums text-ink">{row.total}</span>
          </div>
        ))}
        <span />
        <div className="relative h-4 text-[0.7rem] text-ink-soft" aria-hidden="true">
          {axis.ticks.map((tick) => (
            <span key={tick} className="absolute -translate-x-1/2" style={{ left: widthOf(tick) }}>
              {tick}
            </span>
          ))}
        </div>
        <span />
      </div>
    </div>
  )
}

export const EarlyBirdCapacityPanel = ({ earlyBird }: { earlyBird: EarlyBirdUsage }) => {
  const totals = summarizeEarlyBird(earlyBird)
  const victoria = earlyBird.pools.find((pool) => pool.id === "melbourne")
  const interstate = earlyBird.pools.find((pool) => pool.id === "interstate")
  const capacitySplit = earlyBird.pools.map((pool) => `${POOL_TITLES[pool.id]?.split(" ·")[0] ?? pool.label} ${pool.capacity}`).join(" · ")

  const handleExport = () => {
    downloadTextFile(`early-bird-report-${new Date().toISOString().slice(0, 10)}.csv`, buildEarlyBirdCsv(earlyBird))
  }

  return (
    <section className="cfca-section-panel space-y-4 p-5 sm:p-6" aria-labelledby="early-bird-report-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 id="early-bird-report-title" className="font-display text-2xl font-semibold text-ink">
            Early Bird Registration Report
          </h3>
          <p className="text-sm font-semibold text-ink">
            {formatCalendarDate(earlyBird.windowStart)} – {formatCalendarDate(earlyBird.windowEnd)}
          </p>
          <p className="text-xs text-ink-soft">
            Payment due {formatCalendarDate(earlyBird.paymentDueDate)} · Places counted per adult (18+) · Only paid
            adults are confirmed
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold",
              earlyBird.isOpen ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"
            )}
          >
            <span
              className={cn("h-2 w-2 rounded-full", earlyBird.isOpen ? "bg-emerald-600" : "bg-slate-500")}
              aria-hidden="true"
            />
            {earlyBird.isOpen ? "Early bird open" : "Early bird closed"}
          </span>
          <Button type="button" size="sm" onClick={handleExport} aria-label="Export early bird report as CSV">
            <IconDownload />
            Export report
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Confirmed adults"
          value={String(totals.confirmed)}
          hint={`${percentOf(totals.confirmed, totals.capacity)}% of total capacity`}
          tone="brand"
          icon={<IconUsers />}
        />
        <StatCard
          label="Awaiting payment"
          value={String(totals.reserved)}
          hint="Reserved, not confirmed"
          tone="warning"
          icon={<IconClock />}
        />
        <StatCard
          label="Remaining capacity"
          value={String(totals.remaining)}
          hint="Based on confirmed adults"
          tone="success"
          icon={<IconTarget />}
        />
        <StatCard
          label="Total capacity"
          value={String(totals.capacity)}
          hint={capacitySplit}
          tone="info"
          icon={<IconUsers />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {earlyBird.pools.map((pool) => (
          <PoolPanel key={pool.id} pool={pool} />
        ))}
      </div>

      <StateBars earlyBird={earlyBird} />

      <div className="flex gap-3 rounded-2xl border border-sky-200 bg-sky-50/70 px-5 py-4 text-sky-900">
        <IconInfo />
        <div className="space-y-1">
          <p className="text-sm font-semibold">Capacity rules</p>
          <p className="text-xs leading-relaxed">
            {victoria ? `Victoria has a dedicated cap of ${victoria.capacity}. ` : ""}
            {interstate ? `All other states and territories share one interstate cap of ${interstate.capacity}. ` : ""}
            Places are counted per adult (registrant, spouse, additional adults 18+). Unpaid reservations are shown
            separately and do not reduce remaining paid capacity. Early bird ends on the earlier of the early-bird end
            date and the payment due date.
          </p>
        </div>
      </div>
    </section>
  )
}
