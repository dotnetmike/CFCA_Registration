import { createDashboardValueCache } from "@/lib/dashboard/list-cache"
import { emptyPeopleCount, type PeopleCount } from "@/lib/registrations/people-count"

export type ReportsStateRow = PeopleCount & { registrations: number }

export type ReportsSummary = Record<string, ReportsStateRow>

export type ReportsTotals = PeopleCount & {
  registrations: number
  amount_due: number
  amount_paid: number
  amount_remaining: number
}

export type ReportsPaymentStatusCounts = {
  pending: number
  partial: number
  paid: number
  overpaid: number
}

export type EarlyBirdPoolId = "melbourne" | "interstate"

/** Early-bird slots are counted per registration: VIC has its own cap, all other states share the interstate cap. */
export type EarlyBirdPool = {
  id: EarlyBirdPoolId
  label: string
  capacity: number
  used: number
  remaining: number
}

export type EarlyBirdStateRow = {
  state: string
  pool: EarlyBirdPoolId
  used: number
}

export type EarlyBirdUsage = {
  windowStart: string
  /** Effective last day: the earlier of the early-bird end date and the early-bird payment due date. */
  windowEnd: string
  isOpen: boolean
  pools: EarlyBirdPool[]
  states: EarlyBirdStateRow[]
}

export type ReportsCacheValue = {
  summary: ReportsSummary
  total: number
  totals: ReportsTotals
  paymentStatusCounts: ReportsPaymentStatusCounts
  earlyBird: EarlyBirdUsage | null
}

export const emptyReportsTotals = (): ReportsTotals => ({
  ...emptyPeopleCount(),
  registrations: 0,
  amount_due: 0,
  amount_paid: 0,
  amount_remaining: 0,
})

export const emptyPaymentStatusCounts = (): ReportsPaymentStatusCounts => ({
  pending: 0,
  partial: 0,
  paid: 0,
  overpaid: 0,
})

export const reportsCache = createDashboardValueCache<ReportsCacheValue>({
  storageKey: "cfca.dashboard.reports.v4",
})
