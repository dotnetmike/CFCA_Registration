export type AttendeeInput = {
  age: number
  isPrimary?: boolean
  isSpouse?: boolean
}

export type PricingInput = {
  attendees: AttendeeInput[]
  earlyBirdSlot: "interstate" | "melbourne" | "none"
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

export const calculateTotal = (
  input: PricingInput,
  config: PricingConfig = DEFAULT_PRICING_CONFIG
): number =>
  input.attendees.reduce(
    (sum, attendee) => sum + priceForAttendee(attendee, input.earlyBirdSlot, config),
    0
  )

export const buildPricingBreakdown = (
  attendees: AttendeeInput[],
  earlyBirdSlot: "interstate" | "melbourne" | "none",
  descriptions: string[],
  config: PricingConfig = DEFAULT_PRICING_CONFIG
): PricingLineItem[] =>
  attendees.map((attendee, index) => {
    const amount = priceForAttendee(attendee, earlyBirdSlot, config)
    const band = getAttendeeAgeBand(attendee)
    const isAdult = band === "adult"
    const earlyBirdApplied = isAdult && earlyBirdSlot !== "none"
    const standardAmount = earlyBirdApplied ? config.adultRegular : undefined
    const earlyBirdSaving = earlyBirdApplied
      ? getAdultEarlyBirdSaving(config)
      : undefined

    let note: string | undefined
    if (earlyBirdApplied) {
      note =
        earlyBirdSlot === "melbourne"
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

export const isEarlyBirdWindow = (
  date = new Date(),
  config: PricingConfig = DEFAULT_PRICING_CONFIG
) => {
  const start = new Date(config.earlyBirdStart)
  const end = new Date(
    config.earlyBirdEnd < config.earlyBirdPaymentDueDate
      ? config.earlyBirdEnd
      : config.earlyBirdPaymentDueDate
  )
  return date >= start && date <= end
}

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amount)
