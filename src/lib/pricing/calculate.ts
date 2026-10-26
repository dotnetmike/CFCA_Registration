export type AttendeeInput = {
  age: number
  isPrimary?: boolean
  isSpouse?: boolean
}

export type PricingInput = {
  attendees: AttendeeInput[]
  earlyBirdSlot: "interstate" | "melbourne" | "none"
  /** How many adults (in attendee order) get the early-bird rate; `null` / omitted = all adults. */
  earlyBirdAdultLimit?: number | null
}

export type PricingConfig = {
  adultEarlyBird: number
  adultRegular: number
  age12Plus: number
  age2To12: number
  ageFree: number
  earlyBirdStart: string
  earlyBirdEnd: string
  earlyBirdPaymentDueDate: string
  earlyBirdInterstateLimit: number
  earlyBirdVicLimit: number
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  adultEarlyBird: 220,
  adultRegular: 240,
  age12Plus: 175,
  age2To12: 100,
  ageFree: 0,
  earlyBirdStart: "2026-08-01",
  earlyBirdEnd: "2027-02-28",
  earlyBirdPaymentDueDate: "2027-02-28",
  earlyBirdInterstateLimit: 200,
  earlyBirdVicLimit: 250,
}

export const getAdultEarlyBirdSaving = (config: PricingConfig = DEFAULT_PRICING_CONFIG) =>
  config.adultRegular - config.adultEarlyBird

export type PricingLineItem = {
  description: string
  amount: number
  standardAmount?: number
  earlyBirdSaving?: number
  note?: string
}

export const resolveEarlyBirdSlot = (
  state: string | undefined,
  date = new Date(),
  config: PricingConfig = DEFAULT_PRICING_CONFIG
): "interstate" | "melbourne" | "none" => {
  if (!state || !isEarlyBirdWindow(date, config)) return "none"
  return state === "VIC" ? "melbourne" : "interstate"
}

export const ADULT_MIN_AGE = 18
export const YOUTH_MIN_AGE = 12
export const CHILD_MIN_AGE = 2

export type AttendeeAgeBand = "adult" | "youth" | "child" | "free"

/** Adult 18+ (and the registrant / spouse), youth 12–17, child 2–11, free 0–1. */
export const getAttendeeAgeBand = (attendee: AttendeeInput): AttendeeAgeBand => {
  if (attendee.isPrimary || attendee.isSpouse || attendee.age >= ADULT_MIN_AGE) return "adult"
  if (attendee.age >= YOUTH_MIN_AGE) return "youth"
  if (attendee.age >= CHILD_MIN_AGE) return "child"
  return "free"
}

export const priceForAttendee = (
  attendee: AttendeeInput,
  earlyBirdSlot: "interstate" | "melbourne" | "none",
  config: PricingConfig = DEFAULT_PRICING_CONFIG
): number => {
  const band = getAttendeeAgeBand(attendee)
  if (band === "adult") return earlyBirdSlot !== "none" ? config.adultEarlyBird : config.adultRegular
  if (band === "youth") return config.age12Plus
  if (band === "child") return config.age2To12
  return config.ageFree
}

/** Early-bird slot each attendee is priced at: adults beyond `earlyBirdAdultLimit` fall back to "none". */
export const attendeeEarlyBirdSlots = (
  attendees: AttendeeInput[],
  earlyBirdSlot: "interstate" | "melbourne" | "none",
  earlyBirdAdultLimit?: number | null
): ("interstate" | "melbourne" | "none")[] => {
  let adultIndex = 0
  return attendees.map((attendee) => {
    if (getAttendeeAgeBand(attendee) !== "adult") return earlyBirdSlot
    const withinLimit = earlyBirdAdultLimit == null || adultIndex < earlyBirdAdultLimit
    adultIndex += 1
    return withinLimit ? earlyBirdSlot : "none"
  })
}

export const calculateTotal = (
  input: PricingInput,
  config: PricingConfig = DEFAULT_PRICING_CONFIG
): number => {
  const slots = attendeeEarlyBirdSlots(input.attendees, input.earlyBirdSlot, input.earlyBirdAdultLimit)
  return input.attendees.reduce(
    (sum, attendee, index) => sum + priceForAttendee(attendee, slots[index], config),
    0
  )
}

export const buildPricingBreakdown = (
  attendees: AttendeeInput[],
  earlyBirdSlot: "interstate" | "melbourne" | "none",
  descriptions: string[],
  config: PricingConfig = DEFAULT_PRICING_CONFIG,
  earlyBirdAdultLimit?: number | null
): PricingLineItem[] => {
  const slots = attendeeEarlyBirdSlots(attendees, earlyBirdSlot, earlyBirdAdultLimit)
  return attendees.map((attendee, index) => {
    const attendeeSlot = slots[index]
    const amount = priceForAttendee(attendee, attendeeSlot, config)
    const band = getAttendeeAgeBand(attendee)
    const isAdult = band === "adult"
    const earlyBirdApplied = isAdult && attendeeSlot !== "none"
    const standardAmount = earlyBirdApplied ? config.adultRegular : undefined
    const earlyBirdSaving = earlyBirdApplied
      ? getAdultEarlyBirdSaving(config)
      : undefined

    let note: string | undefined
    if (earlyBirdApplied) {
      note =
        attendeeSlot === "melbourne"
          ? "Early bird — Melbourne slot"
          : "Early bird — Interstate slot"
    } else if (isAdult) {
      note = "Regular adult rate"
    } else if (band === "youth") {
      note = "Child aged 12–17"
    } else if (band === "child") {
      note = "Child aged 2–11"
    } else {
      note = "Aged 0–1 (free)"
    }

    return {
      description: descriptions[index] ?? `Attendee ${index + 1}`,
      amount,
      standardAmount,
      earlyBirdSaving,
      note,
    }
  })
}

/** Calendar date (YYYY-MM-DD) in Melbourne, so settings dates mean the whole local day. */
export const calendarDateInMelbourne = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)

/** Last day new registrations / added adults can get early bird: the earlier of end date and payment due date. */
export const earlyBirdClaimEndDate = (config: PricingConfig) =>
  config.earlyBirdEnd < config.earlyBirdPaymentDueDate ? config.earlyBirdEnd : config.earlyBirdPaymentDueDate

/** Start and end dates are inclusive Melbourne calendar days. */
export const isEarlyBirdWindow = (
  date = new Date(),
  config: PricingConfig = DEFAULT_PRICING_CONFIG
) => {
  const today = calendarDateInMelbourne(date)
  return today >= config.earlyBirdStart && today <= earlyBirdClaimEndDate(config)
}

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amount)
