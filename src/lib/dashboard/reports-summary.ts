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
import { isEarlyBirdWindow, type PricingConfig } from "@/lib/pricing/calculate"
import { addPeopleCounts, countRegistrationPeople, emptyPeopleCount } from "@/lib/registrations/people-count"
import { AUSTRALIAN_STATES } from "@/lib/registrations/schema"

type ReportRegistration = {
  state?: string | null
  is_early_bird?: boolean | null
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

const poolForState = (state: string): EarlyBirdPoolId => (state === "VIC" ? "melbourne" : "interstate")

/** Mirrors `claim_early_bird_slot`: counts registrations holding an early-bird slot, VIC vs every other state. */
export const buildEarlyBirdUsage = (
  registrations: ReportRegistration[],
  config: PricingConfig,
  now = new Date()
): EarlyBirdUsage => {
  const usedByState = new Map<string, number>(AUSTRALIAN_STATES.map((state) => [state, 0]))
  for (const reg of registrations) {
    if (!reg.is_early_bird || !reg.state) continue
    usedByState.set(reg.state, (usedByState.get(reg.state) ?? 0) + 1)
  }

  const states = [...usedByState].map(([state, used]) => ({ state, pool: poolForState(state), used }))
  const usedInPool = (pool: EarlyBirdPoolId) =>
    states.filter((row) => row.pool === pool).reduce((sum, row) => sum + row.used, 0)
  const buildPool = (id: EarlyBirdPoolId, label: string, capacity: number): EarlyBirdPool => {
    const used = usedInPool(id)
    return { id, label, capacity, used, remaining: Math.max(0, capacity - used) }
  }

  return {
    windowStart: config.earlyBirdStart,
    windowEnd:
      config.earlyBirdEnd < config.earlyBirdPaymentDueDate ? config.earlyBirdEnd : config.earlyBirdPaymentDueDate,
    isOpen: isEarlyBirdWindow(now, config),
    pools: [
      buildPool("melbourne", "Victoria", config.earlyBirdVicLimit),
      buildPool("interstate", "Interstate (all other states)", config.earlyBirdInterstateLimit),
    ],
    states,
  }
}
