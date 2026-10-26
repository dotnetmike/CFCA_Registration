import {
  ADULT_MIN_AGE,
  calendarDateInMelbourne,
  earlyBirdClaimEndDate,
  formatCurrency,
  isEarlyBirdWindow,
  type PricingConfig,
} from "@/lib/pricing/calculate"

export { calendarDateInMelbourne, earlyBirdClaimEndDate }

export type EarlyBirdSlot = "interstate" | "melbourne" | "none"
export type EarlyBirdPoolId = "melbourne" | "interstate"

export type EarlyBirdRegistration = {
  state?: string | null
  is_early_bird?: boolean | null
  early_bird_slot?: string | null
  /** Adults (registrant → spouse → additional adults) on the early-bird rate; `null` = all adults. */
  early_bird_adult_limit?: number | null
  spouse_attending?: boolean | null
  amount_paid?: number | string | null
  registration_attendees?: { age?: number | string | null }[] | null
  attendees?: { age?: number | string | null }[] | null
}

const toCents = (amount: number | string | null | undefined) => Math.round((Number(amount) || 0) * 100)

export const earlyBirdPoolForState = (state?: string | null): EarlyBirdPoolId =>
  state === "VIC" ? "melbourne" : "interstate"

export const earlyBirdCapForPool = (pool: EarlyBirdPoolId, config: PricingConfig) =>
  pool === "melbourne" ? config.earlyBirdVicLimit : config.earlyBirdInterstateLimit

export const isEarlyBirdClaimOpen = (config: PricingConfig, now = new Date()) =>
  isEarlyBirdWindow(now, config)

export const isEarlyBirdPaymentDuePassed = (config: PricingConfig, now = new Date()) =>
  calendarDateInMelbourne(now) > config.earlyBirdPaymentDueDate

/** "31 January 2027" for a YYYY-MM-DD settings date. */
export const formatEarlyBirdDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number)
  if (!year || !month || !day) return isoDate
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

/** "$240" for whole-dollar prices, otherwise "$240.50". */
const formatPrice = (amount: number) =>
  Number.isInteger(amount) ? `$${amount.toLocaleString("en-AU")}` : formatCurrency(amount)

export const EARLY_BIRD_REMINDERS_TITLE = "Early Bird Registration – Important Reminders"

export type EarlyBirdReminder = { label: string; text: string }

/** Registrant-facing early bird reminders; dates and the regular rate come from registration settings. */
export const earlyBirdReminders = (config: PricingConfig): EarlyBirdReminder[] => {
  const closes = earlyBirdClaimEndDate(config)
  const due = config.earlyBirdPaymentDueDate
  const deadline =
    closes === due
      ? formatEarlyBirdDate(due)
      : `register by ${formatEarlyBirdDate(closes)} and pay in full by ${formatEarlyBirdDate(due)}`
  return [
    { label: "Limited slots", text: "First-paid, first-served basis." },
    {
      label: "Payment required",
      text: "Registration is secured only upon receipt and confirmation of full payment.",
    },
    {
      label: "Deadline",
      text: `${deadline} or until all early bird slots are filled, whichever comes first.`,
    },
    {
      label: "Unpaid registrations",
      text: `Automatically revert to the regular rate of ${formatPrice(config.adultRegular)} per adult once the early bird offer closes.`,
    },
  ]
}

export const registrationEarlyBirdSlot = (registration: EarlyBirdRegistration): EarlyBirdSlot => {
  if (!registration.is_early_bird) return "none"
  const slot = registration.early_bird_slot
  return slot === "melbourne" || slot === "interstate" ? slot : "none"
}

/** Registrant and spouse are always adults; additional attendees count from age 18. */
export const registrationAdultCount = (registration: EarlyBirdRegistration) => {
  const attendees = registration.registration_attendees ?? registration.attendees ?? []
  const additionalAdults = attendees.filter((attendee) => Number(attendee.age) >= ADULT_MIN_AGE).length
  return 1 + (registration.spouse_attending ? 1 : 0) + additionalAdults
}

export const earlyBirdAdultCount = (registration: EarlyBirdRegistration) => {
  if (registrationEarlyBirdSlot(registration) === "none") return 0
  const adults = registrationAdultCount(registration)
  const limit = registration.early_bird_adult_limit
  return limit == null ? adults : Math.max(0, Math.min(limit, adults))
}

/** Early-bird adults covered by payment: each adult early-bird fee paid confirms one adult, in order. */
export const confirmedEarlyBirdAdults = (registration: EarlyBirdRegistration, config: PricingConfig) => {
  const earlyBirdAdults = earlyBirdAdultCount(registration)
  if (earlyBirdAdults === 0) return 0
  const pricePerAdult = toCents(config.adultEarlyBird)
  if (pricePerAdult <= 0) return earlyBirdAdults
  return Math.min(earlyBirdAdults, Math.floor(toCents(registration.amount_paid) / pricePerAdult))
}

export type EarlyBirdAdultTally = { confirmed: number; reserved: number }

export const earlyBirdAdultTally = (
  registration: EarlyBirdRegistration,
  config: PricingConfig
): EarlyBirdAdultTally => {
  const earlyBirdAdults = earlyBirdAdultCount(registration)
  const confirmed = confirmedEarlyBirdAdults(registration, config)
  return { confirmed, reserved: earlyBirdAdults - confirmed }
}

export const formatAdultCount = (count: number) => (count === 1 ? "1 adult" : `${count} adults`)

/** Reminders apply while early-bird adults on the registration are unpaid and the payment due date has not passed. */
export const showsEarlyBirdReminders = (
  registration: EarlyBirdRegistration,
  config: PricingConfig,
  now = new Date()
) => !isEarlyBirdPaymentDuePassed(config, now) && earlyBirdAdultTally(registration, config).reserved > 0

export const confirmedEarlyBirdAdultsByPool = (
  registrations: EarlyBirdRegistration[],
  config: PricingConfig
): Record<EarlyBirdPoolId, number> => {
  const totals: Record<EarlyBirdPoolId, number> = { melbourne: 0, interstate: 0 }
  for (const registration of registrations) {
    if (registrationEarlyBirdSlot(registration) === "none") continue
    totals[earlyBirdPoolForState(registration.state)] += confirmedEarlyBirdAdults(registration, config)
  }
  return totals
}

/**
 * Adults to put on early bird when a registration is submitted or edited.
 * Adults already on early bird keep it; more are added only while claiming is open and the pool has room.
 */
export const decideEarlyBirdAdults = (params: {
  adults: number
  existingEarlyBirdAdults: number
  poolConfirmedByOthers: number
  cap: number
  claimOpen: boolean
}) => {
  const kept = Math.min(params.existingEarlyBirdAdults, params.adults)
  if (!params.claimOpen) return kept
  const room = Math.max(0, params.cap - params.poolConfirmedByOthers)
  return Math.min(params.adults, Math.max(kept, room))
}
