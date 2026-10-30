import type { ReportsSummary, ReportsTotals } from "@/lib/dashboard/reports-cache"
import { percentOf } from "@/lib/dashboard/early-bird-report"

export const adultTotal = (totals: ReportsTotals) =>
  totals.registrants + totals.spouses + totals.additionalAdults

export type CollectionProgress = {
  /** Amount paid as % of registration fees (one decimal). */
  collectedPercent: number
  /** Balance due as % of registration fees (one decimal). */
  balancePercent: number
  /** Bar widths (0–100), normalised so overpayments never overflow the bar. */
  collectedWidth: number
  balanceWidth: number
}

export const collectionProgress = (totals: ReportsTotals): CollectionProgress => {
  const collectedPercent = percentOf(totals.amount_paid, totals.amount_due)
  const balancePercent = percentOf(totals.amount_remaining, totals.amount_due)
  const barTotal = Math.max(collectedPercent + balancePercent, 100)
  return {
    collectedPercent,
    balancePercent,
    collectedWidth: (collectedPercent / barTotal) * 100,
    balanceWidth: (balancePercent / barTotal) * 100,
  }
}

export type CompositionRow = { key: string; label: string; value: number; percent: number; color: string }

export const compositionRows = (totals: ReportsTotals): CompositionRow[] =>
  [
    { key: "registrants", label: "Primary registrants", value: totals.registrants, color: "#1e5aa8" },
    { key: "spouses", label: "Spouses", value: totals.spouses, color: "#5b8fe0" },
    { key: "additionalAdults", label: "Additional adults (18+)", value: totals.additionalAdults, color: "#a9c6f2" },
    { key: "kids", label: "Children (under 18)", value: totals.kids, color: "#f5b82e" },
  ].map((row) => ({ ...row, percent: percentOf(row.value, totals.people) }))

export type StateRegistrationRow = { state: string; registrations: number; percent: number }

export const stateRegistrationRows = (summary: ReportsSummary, totalRegistrations: number): StateRegistrationRow[] =>
  Object.entries(summary)
    .map(([state, row]) => ({
      state,
      registrations: row.registrations,
      percent: percentOf(row.registrations, totalRegistrations),
    }))
    .sort((a, b) => b.registrations - a.registrations || a.state.localeCompare(b.state))

const STATE_NAMES: Record<string, string> = {
  NSW: "New South Wales",
  VIC: "Victoria",
  QLD: "Queensland",
  SA: "South Australia",
  WA: "Western Australia",
  TAS: "Tasmania",
  NT: "Northern Territory",
  ACT: "Australian Capital Territory",
}

/** e.g. "Victoria accounts for 80.9% of registrations." */
export const topStateInsight = (rows: StateRegistrationRow[]) => {
  const top = rows[0]
  if (!top || top.registrations === 0) return ""
  return `${STATE_NAMES[top.state] ?? top.state} accounts for ${top.percent}% of registrations.`
}
