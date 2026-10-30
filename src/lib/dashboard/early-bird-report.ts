import type { EarlyBirdPool, EarlyBirdUsage } from "@/lib/dashboard/reports-cache"

export const LOW_REMAINING_SHARE = 0.1

export type EarlyBirdTotals = {
  confirmed: number
  reserved: number
  remaining: number
  capacity: number
}

export const summarizeEarlyBird = (earlyBird: EarlyBirdUsage): EarlyBirdTotals =>
  earlyBird.pools.reduce(
    (sum, pool) => ({
      confirmed: sum.confirmed + pool.used,
      reserved: sum.reserved + pool.reserved,
      remaining: sum.remaining + pool.remaining,
      capacity: sum.capacity + pool.capacity,
    }),
    { confirmed: 0, reserved: 0, remaining: 0, capacity: 0 }
  )

/** Share as a percentage with one decimal, e.g. 10.4. */
export const percentOf = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0

export type PoolSegments = { confirmed: number; awaiting: number; unallocated: number }

/** Donut segments within the pool capacity; reservations beyond the free places are not drawn. */
export const poolSegments = (pool: EarlyBirdPool): PoolSegments => {
  const confirmed = Math.min(pool.used, pool.capacity)
  const awaiting = Math.min(pool.reserved, Math.max(0, pool.capacity - confirmed))
  return { confirmed, awaiting, unallocated: Math.max(0, pool.capacity - confirmed - awaiting) }
}

export const isPoolNearlyFull = (pool: EarlyBirdPool) => pool.remaining <= pool.capacity * LOW_REMAINING_SHARE

/** Axis maximum and ticks with a "nice" step (1, 2, 5 × 10ⁿ) and at most 8 intervals. */
export const niceAxis = (max: number) => {
  if (max <= 0) return { max: 5, ticks: [0, 1, 2, 3, 4, 5] }
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)))
  const step = [1, 2, 5, 10].map((factor) => factor * magnitude).find((candidate) => max / candidate <= 8) ?? magnitude * 10
  const axisMax = Math.ceil(max / step) * step
  const ticks = Array.from({ length: Math.round(axisMax / step) + 1 }, (_, index) => index * step)
  return { max: axisMax, ticks }
}

export type EarlyBirdStateBar = { state: string; pool: string; confirmed: number; reserved: number; total: number }

export const earlyBirdStateBars = (earlyBird: EarlyBirdUsage): EarlyBirdStateBar[] =>
  earlyBird.states
    .map((row) => ({
      state: row.state,
      pool: row.pool,
      confirmed: row.used,
      reserved: row.reserved,
      total: row.used + row.reserved,
    }))
    .sort((a, b) => b.total - a.total || b.confirmed - a.confirmed || a.state.localeCompare(b.state))

const csvCell = (value: string | number) => {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export const buildEarlyBirdCsv = (earlyBird: EarlyBirdUsage) => {
  const poolsById = new Map(earlyBird.pools.map((pool) => [pool.id, pool]))
  const rows: (string | number)[][] = [
    ["Early bird window", `${earlyBird.windowStart} to ${earlyBird.windowEnd}`],
    ["Payment due", earlyBird.paymentDueDate],
    ["Status", earlyBird.isOpen ? "Open" : "Closed"],
    [],
    ["Capacity group", "Capacity", "Confirmed adults (paid)", "Awaiting payment (reserved)", "Remaining"],
    ...earlyBird.pools.map((pool) => [pool.label, pool.capacity, pool.used, pool.reserved, pool.remaining]),
    [],
    ["State", "Capacity group", "Confirmed adults (paid)", "Awaiting payment (reserved)", "Total"],
    ...earlyBirdStateBars(earlyBird).map((row) => [
      row.state,
      poolsById.get(row.pool as EarlyBirdPool["id"])?.label ?? row.pool,
      row.confirmed,
      row.reserved,
      row.total,
    ]),
  ]
  return rows.map((row) => row.map(csvCell).join(",")).join("\n")
}
