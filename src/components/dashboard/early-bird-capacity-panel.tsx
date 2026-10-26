import { DashboardPanel } from "@/components/dashboard/dashboard-panel"
import { formatCalendarDate } from "@/components/reconciliation/format"
import type { EarlyBirdPool, EarlyBirdUsage } from "@/lib/dashboard/reports-cache"

const LOW_REMAINING_SHARE = 0.1

const usedPercent = (pool: EarlyBirdPool) =>
  pool.capacity > 0 ? Math.min(100, Math.round((pool.used / pool.capacity) * 100)) : 0

const isNearlyFull = (pool: EarlyBirdPool) => pool.remaining <= pool.capacity * LOW_REMAINING_SHARE

const PoolCard = ({ pool }: { pool: EarlyBirdPool }) => (
  <div className="space-y-3 rounded-xl border border-[color:var(--line)] bg-mist/40 p-4">
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-sm font-semibold text-ink">{pool.label}</p>
      <p className="text-xs text-ink-soft">{usedPercent(pool)}% confirmed</p>
    </div>
    <p className="font-display text-3xl font-semibold tabular-nums text-ink">
      {pool.used}
      <span className="text-base font-normal text-ink-soft"> / {pool.capacity} adults confirmed</span>
    </p>
    <div
      className="cfca-progress-track"
      role="progressbar"
      aria-label={`${pool.label} early bird places confirmed by payment`}
      aria-valuemin={0}
      aria-valuemax={pool.capacity}
      aria-valuenow={pool.used}
    >
      <div className="cfca-progress-fill" style={{ width: `${usedPercent(pool)}%` }} />
    </div>
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <p
        className={
          isNearlyFull(pool) ? "text-sm font-semibold text-[color:var(--danger)]" : "text-sm text-ink-soft"
        }
      >
        {pool.remaining} remaining
      </p>
      <p className="text-sm text-ink-soft">{pool.reserved} reserved, awaiting payment</p>
    </div>
  </div>
)

export const EarlyBirdCapacityPanel = ({ earlyBird }: { earlyBird: EarlyBirdUsage }) => {
  const poolsById = new Map(earlyBird.pools.map((pool) => [pool.id, pool]))
  const stateRows = [...earlyBird.states].sort(
    (a, b) =>
      Number(b.pool === "melbourne") - Number(a.pool === "melbourne") ||
      b.used - a.used ||
      b.reserved - a.reserved ||
      a.state.localeCompare(b.state)
  )

  return (
    <DashboardPanel
      title="Early bird capacity"
      description={`Early bird ${formatCalendarDate(earlyBird.windowStart)} – ${formatCalendarDate(earlyBird.windowEnd)} · ${earlyBird.isOpen ? "Open now" : "Closed"} · payment due ${formatCalendarDate(earlyBird.paymentDueDate)}. Places are counted per adult (registrant, spouse, additional adults 18+) and only adults covered by payment are confirmed. Victoria has its own cap and all other states share the interstate cap.`}
      bodyClassName="space-y-5 p-0 sm:p-0"
    >
      <div className="grid gap-4 px-5 pt-5 sm:grid-cols-2 sm:px-6 sm:pt-6">
        {earlyBird.pools.map((pool) => (
          <PoolCard key={pool.id} pool={pool} />
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="cfca-reports-table">
          <thead>
            <tr>
              <th className="px-5 sm:px-6">State</th>
              <th>Confirmed adults (paid)</th>
              <th>Reserved adults (unpaid)</th>
              <th>Capacity group</th>
              <th>Group capacity</th>
              <th className="px-5 sm:px-6">Group remaining</th>
            </tr>
          </thead>
          <tbody>
            {stateRows.map((row) => {
              const pool = poolsById.get(row.pool)
              return (
                <tr key={row.state}>
                  <td className="px-5 font-semibold sm:px-6">{row.state}</td>
                  <td className="tabular-nums">{row.used}</td>
                  <td className="tabular-nums text-ink-soft">{row.reserved}</td>
                  <td className="text-ink-soft">{row.pool === "melbourne" ? "Victoria" : "Interstate (shared)"}</td>
                  <td className="tabular-nums">{pool?.capacity ?? "—"}</td>
                  <td className="px-5 tabular-nums sm:px-6">{pool?.remaining ?? "—"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </DashboardPanel>
  )
}
