export type AttendeeInput = {
  age: number
  isPrimary?: boolean
  isSpouse?: boolean
}

export type PricingInput = {
  attendees: AttendeeInput[]
  earlyBirdSlot: "interstate" | "melbourne" | "none"
}

const ADULT_EARLY_BIRD = 220
const ADULT_REGULAR = 240
const AGE_12_PLUS = 175
const AGE_2_TO_12 = 100
const AGE_FREE = 0

export const ADULT_EARLY_BIRD_SAVING = ADULT_REGULAR - ADULT_EARLY_BIRD

export type PricingLineItem = {
  description: string
  amount: number
  standardAmount?: number
  earlyBirdSaving?: number
  note?: string
}

export const resolveEarlyBirdSlot = (
  state: string | undefined,
  date = new Date()
): "interstate" | "melbourne" | "none" => {
  if (!state || !isEarlyBirdWindow(date)) return "none"
  return state === "VIC" ? "melbourne" : "interstate"
}

export const priceForAttendee = (
  attendee: AttendeeInput,
  earlyBirdSlot: "interstate" | "melbourne" | "none"
): number => {
  const { age, isPrimary, isSpouse } = attendee

  if (isPrimary || isSpouse) {
    if (earlyBirdSlot !== "none") return ADULT_EARLY_BIRD
    return ADULT_REGULAR
  }

  if (age <= 1) return AGE_FREE
  if (age >= 2 && age <= 12) return AGE_2_TO_12
  if (age >= 12) return AGE_12_PLUS
  return AGE_FREE
}

export const calculateTotal = (input: PricingInput): number =>
  input.attendees.reduce(
    (sum, attendee) => sum + priceForAttendee(attendee, input.earlyBirdSlot),
    0
  )

export const buildPricingBreakdown = (
  attendees: AttendeeInput[],
  earlyBirdSlot: "interstate" | "melbourne" | "none",
  descriptions: string[]
): PricingLineItem[] =>
  attendees.map((attendee, index) => {
    const amount = priceForAttendee(attendee, earlyBirdSlot)
    const isAdult = attendee.isPrimary || attendee.isSpouse
    const earlyBirdApplied = isAdult && earlyBirdSlot !== "none"
    const standardAmount = earlyBirdApplied ? ADULT_REGULAR : undefined
    const earlyBirdSaving = earlyBirdApplied ? ADULT_EARLY_BIRD_SAVING : undefined

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

export const isEarlyBirdWindow = (date = new Date()) => {
  const start = new Date("2026-08-01")
  const end = new Date("2027-02-28")
  return date >= start && date <= end
}

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amount)
