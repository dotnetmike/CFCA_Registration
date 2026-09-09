import { createDashboardValueCache } from "@/lib/dashboard/list-cache"

export type ReportsSummary = Record<
  string,
  { attendees: number; spouses: number; kids: number; registrations: number }
>

export type ReportsTotals = {
  registrations: number
  attendees: number
  spouses: number
  kids: number
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
  registrations: 0,
  attendees: 0,
  spouses: 0,
  kids: 0,
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
  storageKey: "cfca.dashboard.reports.v2",
})
