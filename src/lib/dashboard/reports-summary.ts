import {
  emptyPaymentStatusCounts,
  emptyReportsTotals,
  type EarlyBirdPool,
  type EarlyBirdPoolId,
  type EarlyBirdUsage,
  type ReportsPaymentStatusCounts,
  type ReportsSummary,
  type ReportsTotals,
} from "@/lib/dashboard/reports-cache"
import type { PricingConfig } from "@/lib/pricing/calculate"
import {
  earlyBirdAdultTally,
  earlyBirdClaimEndDate,
  earlyBirdPoolForState,
  isEarlyBirdClaimOpen,
} from "@/lib/pricing/early-bird"
import { addPeopleCounts, countRegistrationPeople, emptyPeopleCount } from "@/lib/registrations/people-count"
import { AUSTRALIAN_STATES } from "@/lib/registrations/schema"

type ReportRegistration = {
  state?: string | null
  is_early_bird?: boolean | null
  early_bird_slot?: string | null
  early_bird_adult_limit?: number | null
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

/** Early-bird adults per state: confirmed (covered by payment) use capacity, unpaid ones are only reserved. */
export const buildEarlyBirdUsage = (
  registrations: ReportRegistration[],
  config: PricingConfig,
  now = new Date()
): EarlyBirdUsage => {
  const byState = new Map(AUSTRALIAN_STATES.map((state) => [state as string, { used: 0, reserved: 0 }]))
  for (const reg of registrations) {
    if (!reg.state) continue
    const { confirmed, reserved } = earlyBirdAdultTally(reg, config)
    if (confirmed === 0 && reserved === 0) continue
    const row = byState.get(reg.state) ?? { used: 0, reserved: 0 }
    row.used += confirmed
    row.reserved += reserved
    byState.set(reg.state, row)
  }

  const states = [...byState].map(([state, counts]) => ({
    state,
    pool: earlyBirdPoolForState(state),
    ...counts,
  }))
  const sumInPool = (pool: EarlyBirdPoolId, key: "used" | "reserved") =>
    states.filter((row) => row.pool === pool).reduce((sum, row) => sum + row[key], 0)
  const buildPool = (id: EarlyBirdPoolId, label: string, capacity: number): EarlyBirdPool => {
    const used = sumInPool(id, "used")
    return { id, label, capacity, used, reserved: sumInPool(id, "reserved"), remaining: Math.max(0, capacity - used) }
  }

  return {
    windowStart: config.earlyBirdStart,
    windowEnd: earlyBirdClaimEndDate(config),
    paymentDueDate: config.earlyBirdPaymentDueDate,
    isOpen: isEarlyBirdClaimOpen(config, now),
    pools: [
      buildPool("melbourne", "Victoria", config.earlyBirdVicLimit),
      buildPool("interstate", "Interstate (all other states)", config.earlyBirdInterstateLimit),
    ],
    states,
  }
}
