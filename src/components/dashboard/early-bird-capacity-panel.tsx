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
      <p className="text-xs text-ink-soft">{usedPercent(pool)}% used</p>
    </div>
    <p className="font-display text-3xl font-semibold tabular-nums text-ink">
      {pool.used}
      <span className="text-base font-normal text-ink-soft"> / {pool.capacity}</span>
    </p>
    <div
      className="cfca-progress-track"
      role="progressbar"
      aria-label={`${pool.label} early bird slots used`}
      aria-valuemin={0}
      aria-valuemax={pool.capacity}
      aria-valuenow={pool.used}
    >
      <div className="cfca-progress-fill" style={{ width: `${usedPercent(pool)}%` }} />
    </div>
    <p
      className={
        isNearlyFull(pool) ? "text-sm font-semibold text-[color:var(--danger)]" : "text-sm text-ink-soft"
      }
    >
      {pool.remaining} remaining
    </p>
  </div>
)

export const EarlyBirdCapacityPanel = ({ earlyBird }: { earlyBird: EarlyBirdUsage }) => {
  const poolsById = new Map(earlyBird.pools.map((pool) => [pool.id, pool]))
  const stateRows = [...earlyBird.states].sort(
    (a, b) => Number(b.pool === "melbourne") - Number(a.pool === "melbourne") || b.used - a.used || a.state.localeCompare(b.state)
  )

  return (
    <DashboardPanel
      title="Early bird capacity"
      description={`Window ${formatCalendarDate(earlyBird.windowStart)} – ${formatCalendarDate(earlyBird.windowEnd)} · ${earlyBird.isOpen ? "Open now" : "Closed"}. Slots are counted per registration: Victoria has its own cap and all other states share the interstate cap.`}
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
              <th>Early bird registrations</th>
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
