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

export type ReportsCacheValue = {
  summary: ReportsSummary
  total: number
  totals: ReportsTotals
  paymentStatusCounts: ReportsPaymentStatusCounts
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
  storageKey: "cfca.dashboard.reports.v3",
})
