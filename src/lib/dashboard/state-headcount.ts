import type { ReportsSummary, ReportsStateRow } from "@/lib/dashboard/reports-cache"
import { AUSTRALIAN_STATES } from "@/lib/registrations/schema"

export type StateHeadcount = { state: string; adults: number }

export type StateHeadcountReport = {
  states: StateHeadcount[]
  /** Adults on registrations without a recognised Australian state. */
  unassigned: number
  total: number
}

export const adultCount = (row: Partial<ReportsStateRow> | undefined) =>
  (row?.registrants ?? 0) + (row?.spouses ?? 0) + (row?.additionalAdults ?? 0)

/** Adults (registrants + spouses + additional adults 18+) per state; every state is listed, even at 0. */
export const buildStateHeadcounts = (summary: ReportsSummary): StateHeadcountReport => {
  const known = new Set<string>(AUSTRALIAN_STATES)
  const states = AUSTRALIAN_STATES.map((state) => ({ state: state as string, adults: adultCount(summary[state]) }))
  const unassigned = Object.entries(summary)
    .filter(([state]) => !known.has(state))
    .reduce((sum, [, row]) => sum + adultCount(row), 0)
  const total = states.reduce((sum, row) => sum + row.adults, unassigned)
  return { states, unassigned, total }
}

/** "28 Oct 2026" in Melbourne time. */
export const formatHeadcountAsOf = (timestamp: number) =>
  new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  }).format(new Date(timestamp))
