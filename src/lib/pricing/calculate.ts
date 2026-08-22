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
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  adultEarlyBird: 220,
  adultRegular: 240,
  age12Plus: 175,
  age2To12: 100,
  ageFree: 0,
  earlyBirdStart: "2026-08-01",
  earlyBirdEnd: "2027-02-28",
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

export const priceForAttendee = (
  attendee: AttendeeInput,
  earlyBirdSlot: "interstate" | "melbourne" | "none",
  config: PricingConfig = DEFAULT_PRICING_CONFIG
): number => {
  const { age, isPrimary, isSpouse } = attendee

  if (isPrimary || isSpouse) {
    if (earlyBirdSlot !== "none") return config.adultEarlyBird
    return config.adultRegular
  }

  if (age <= 1) return config.ageFree
  if (age >= 2 && age <= 12) return config.age2To12
  if (age >= 12) return config.age12Plus
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
    const isAdult = attendee.isPrimary || attendee.isSpouse
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
    } else if (attendee.age <= 1) {
      note = "Aged 1 and under"
    } else if (attendee.age >= 2 && attendee.age <= 12) {
      note = "Child aged 2–12"
    } else if (attendee.age >= 12) {
      note = "Child aged 12+"
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
  const end = new Date(config.earlyBirdEnd)
  return date >= start && date <= end
}

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amount)
