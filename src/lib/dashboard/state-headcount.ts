import type { ReportsSummary, ReportsStateRow } from "@/lib/dashboard/reports-cache"
import { AUSTRALIAN_STATES } from "@/lib/registrations/schema"

export type HeadcountBreakdown = {
  people: number
  /** Registrant + spouse + additional attendees 18+. */
  adults: number
  /** 12–17. */
  teens: number
  /** 2–11. */
  children: number
  /** 0–1. */
  infants: number
}

export type StateHeadcount = HeadcountBreakdown & { state: string }

export type StateHeadcountReport = {
  states: StateHeadcount[]
  /** People on registrations without a recognised Australian state. */
  unassigned: HeadcountBreakdown
  total: HeadcountBreakdown
}

export type HeadcountBandKey = "children" | "teens" | "adults" | "infants"

/** Bands an admin can filter the report by. */
export type SelectableBandKey = Exclude<HeadcountBandKey, "infants">

export type HeadcountBand = { key: HeadcountBandKey; label: string; note: string }

export const HEADCOUNT_BANDS: HeadcountBand[] = [
  { key: "children", label: "Kids (2–11)", note: "Kids 2–11 only" },
  { key: "teens", label: "Teens (12–17)", note: "Teens 12–17 only" },
  { key: "adults", label: "Adults (18+)", note: "Adults 18+ only" },
]

export const INFANT_BAND: HeadcountBand = { key: "infants", label: "Infants (0–1)", note: "Infants 0–1 only" }

/** Bands to display: infants are listed only when any are registered, so the bands always add up to the total. */
export const visibleHeadcountBands = (total: HeadcountBreakdown) =>
  total.infants > 0 ? [INFANT_BAND, ...HEADCOUNT_BANDS] : HEADCOUNT_BANDS

export type HeadcountSelection = SelectableBandKey[]

export const ALL_SELECTABLE_BANDS: HeadcountSelection = ["adults", "children", "teens"]

/** Every group ticked counts everyone, infants (0–1) included, so the total matches the Attendees KPI. */
export const isEveryoneSelected = (selection: HeadcountSelection) =>
  ALL_SELECTABLE_BANDS.every((key) => selection.includes(key))

/** Adds or removes a group; the last remaining group cannot be removed. */
export const toggleHeadcountBand = (
  selection: HeadcountSelection,
  key: SelectableBandKey
): HeadcountSelection => {
  if (!selection.includes(key)) return [...selection, key]
  if (selection.length === 1) return selection
  return selection.filter((item) => item !== key)
}

/** Bands shown on the cards for a selection, in display order (Kids, Teens, Adults). */
export const bandsForSelection = (total: HeadcountBreakdown, selection: HeadcountSelection) =>
  isEveryoneSelected(selection)
    ? visibleHeadcountBands(total)
    : HEADCOUNT_BANDS.filter((band) => selection.includes(band.key as SelectableBandKey))

export const headcountForSelection = (breakdown: HeadcountBreakdown, selection: HeadcountSelection) =>
  isEveryoneSelected(selection)
    ? breakdown.people
    : selection.reduce((sum, key) => sum + breakdown[key], 0)

const emptyBreakdown = (): HeadcountBreakdown => ({ people: 0, adults: 0, teens: 0, children: 0, infants: 0 })

export const adultCount = (row: Partial<ReportsStateRow> | undefined) =>
  (row?.registrants ?? 0) + (row?.spouses ?? 0) + (row?.additionalAdults ?? 0)

/** Everyone attending, split into adults (18+), teens (12–17), kids (2–11) and infants (0–1). */
export const headcountBreakdown = (row: Partial<ReportsStateRow> | undefined): HeadcountBreakdown => {
  const adults = adultCount(row)
  const teens = row?.teens ?? 0
  const children = row?.children ?? 0
  const infants = row?.infants ?? 0
  return { people: adults + teens + children + infants, adults, teens, children, infants }
}

const addBreakdown = (sum: HeadcountBreakdown, row: HeadcountBreakdown): HeadcountBreakdown => ({
  people: sum.people + row.people,
  adults: sum.adults + row.adults,
  teens: sum.teens + row.teens,
  children: sum.children + row.children,
  infants: sum.infants + row.infants,
})

/** All attendees per state; every state is listed, even at 0. The total is the sum of the states (plus unassigned). */
export const buildStateHeadcounts = (summary: ReportsSummary): StateHeadcountReport => {
  const known = new Set<string>(AUSTRALIAN_STATES)
  const states = AUSTRALIAN_STATES.map((state) => ({
    state: state as string,
    ...headcountBreakdown(summary[state]),
  }))
  const unassignedRows = Object.entries(summary)
    .filter(([state]) => !known.has(state))
    .map(([, row]) => headcountBreakdown(row))
  const unassigned = unassignedRows.reduce(addBreakdown, emptyBreakdown())
  const total = states.reduce(addBreakdown, unassigned)
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
