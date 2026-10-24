import {
  emptyPaymentStatusCounts,
  emptyReportsTotals,
  type ReportsPaymentStatusCounts,
  type ReportsSummary,
  type ReportsTotals,
} from "@/lib/dashboard/reports-cache"
import { addPeopleCounts, countRegistrationPeople, emptyPeopleCount } from "@/lib/registrations/people-count"

type ReportRegistration = {
  state?: string | null
  spouse_attending?: boolean | null
  payment_status?: string | null
  amount_due?: number | string | null
  amount_paid?: number | string | null
  registration_attendees?: { age?: number | string | null }[] | null
}

export const buildReportsSummary = (registrations: ReportRegistration[]) => {
  const summary: ReportsSummary = {}
  const totals: ReportsTotals = emptyReportsTotals()
  const paymentStatusCounts: ReportsPaymentStatusCounts = emptyPaymentStatusCounts()

  for (const reg of registrations) {
    const state = reg.state ?? "Unknown"
    summary[state] ??= { ...emptyPeopleCount(), registrations: 0 }
    const people = countRegistrationPeople(reg)
    summary[state].registrations += 1
    addPeopleCounts(summary[state], people)
    totals.registrations += 1
    addPeopleCounts(totals, people)

    const status = String(reg.payment_status ?? "pending")
    if (status in paymentStatusCounts) {
      paymentStatusCounts[status as keyof ReportsPaymentStatusCounts] += 1
    }

    totals.amount_due += Number(reg.amount_due ?? 0)
    totals.amount_paid += Number(reg.amount_paid ?? 0)
  }

  totals.amount_remaining = Math.max(0, totals.amount_due - totals.amount_paid)
  return { summary, totals, paymentStatusCounts }
}
