import assert from "node:assert/strict"
import test from "node:test"

import { DEFAULT_PRICING_CONFIG, buildPricingBreakdown, calculateTotal } from "./calculate"
import {
  confirmedEarlyBirdAdults,
  confirmedEarlyBirdAdultsByPool,
  decideEarlyBirdAdults,
  earlyBirdAdultCount,
  earlyBirdReminders,
  formatEarlyBirdDate,
  showsEarlyBirdReminders,
  isEarlyBirdClaimOpen,
  isEarlyBirdPaymentDuePassed,
  registrationAdultCount,
} from "./early-bird"

const config = { ...DEFAULT_PRICING_CONFIG, earlyBirdStart: "2026-10-01", earlyBirdEnd: "2027-01-31", earlyBirdPaymentDueDate: "2027-01-31" }

const fiveAdults = {
  state: "VIC",
  is_early_bird: true,
  early_bird_slot: "melbourne",
  spouse_attending: true,
  registration_attendees: [{ age: 95 }, { age: 90 }, { age: 80 }, { age: 10 }],
}

test("adults are the registrant, spouse and additional attendees aged 18+", () => {
  assert.equal(registrationAdultCount(fiveAdults), 5)
  assert.equal(registrationAdultCount({ spouse_attending: false, attendees: [{ age: 17 }, { age: 18 }] }), 2)
})

test("a NULL limit means every adult is on early bird; a limit caps it", () => {
  assert.equal(earlyBirdAdultCount(fiveAdults), 5)
  assert.equal(earlyBirdAdultCount({ ...fiveAdults, early_bird_adult_limit: 2 }), 2)
  assert.equal(earlyBirdAdultCount({ ...fiveAdults, early_bird_adult_limit: 9 }), 5)
  assert.equal(earlyBirdAdultCount({ ...fiveAdults, is_early_bird: false }), 0)
})

test("each adult early-bird fee paid confirms one adult", () => {
  assert.equal(confirmedEarlyBirdAdults({ ...fiveAdults, amount_paid: 220 }, config), 1)
  assert.equal(confirmedEarlyBirdAdults({ ...fiveAdults, amount_paid: 439.99 }, config), 1)
  assert.equal(confirmedEarlyBirdAdults({ ...fiveAdults, amount_paid: 0 }, config), 0)
  assert.equal(confirmedEarlyBirdAdults({ ...fiveAdults, amount_paid: 5000 }, config), 5)
})

test("pool usage counts confirmed adults, VIC vs every other state", () => {
  const usage = confirmedEarlyBirdAdultsByPool(
    [
      { ...fiveAdults, amount_paid: 660 },
      { state: "NSW", is_early_bird: true, early_bird_slot: "interstate", spouse_attending: true, amount_paid: 440 },
      { state: "WA", is_early_bird: true, early_bird_slot: "interstate", spouse_attending: true, amount_paid: 0 },
      { state: "VIC", is_early_bird: false, early_bird_slot: "none", amount_paid: 240 },
    ],
    config
  )
  assert.deepEqual(usage, { melbourne: 3, interstate: 2 })
})

test("claiming gives early bird to as many adults as the pool has room for", () => {
  assert.equal(decideEarlyBirdAdults({ adults: 3, existingEarlyBirdAdults: 0, poolConfirmedByOthers: 248, cap: 250, claimOpen: true }), 2)
  assert.equal(decideEarlyBirdAdults({ adults: 3, existingEarlyBirdAdults: 0, poolConfirmedByOthers: 250, cap: 250, claimOpen: true }), 0)
  assert.equal(decideEarlyBirdAdults({ adults: 4, existingEarlyBirdAdults: 2, poolConfirmedByOthers: 250, cap: 250, claimOpen: true }), 2)
  assert.equal(decideEarlyBirdAdults({ adults: 4, existingEarlyBirdAdults: 2, poolConfirmedByOthers: 0, cap: 250, claimOpen: false }), 2)
  assert.equal(decideEarlyBirdAdults({ adults: 1, existingEarlyBirdAdults: 2, poolConfirmedByOthers: 0, cap: 250, claimOpen: false }), 1)
})

test("claim window and due date use whole Melbourne calendar days", () => {
  assert.equal(isEarlyBirdClaimOpen(config, new Date("2027-01-31T12:59:00Z")), true)
  assert.equal(isEarlyBirdClaimOpen(config, new Date("2027-01-31T13:01:00Z")), false)
  assert.equal(isEarlyBirdPaymentDuePassed(config, new Date("2027-01-31T12:59:00Z")), false)
  assert.equal(isEarlyBirdPaymentDuePassed(config, new Date("2027-01-31T13:01:00Z")), true)
})

test("dates are written out in full", () => {
  assert.equal(formatEarlyBirdDate("2027-01-31"), "31 January 2027")
})

test("early bird reminders take the deadline and regular rate from settings", () => {
  assert.deepEqual(earlyBirdReminders(config), [
    { label: "Limited slots", text: "First-paid, first-served basis." },
    { label: "Payment required", text: "Registration is secured only upon receipt and confirmation of full payment." },
    { label: "Deadline", text: "31 January 2027 or until all early bird slots are filled, whichever comes first." },
    {
      label: "Unpaid registrations",
      text: "Automatically revert to the regular rate of $240 per adult once the early bird offer closes.",
    },
  ])
  const split = earlyBirdReminders({ ...config, earlyBirdEnd: "2027-01-15", adultRegular: 245.5 })
  assert.equal(
    split[2].text,
    "register by 15 January 2027 and pay in full by 31 January 2027 or until all early bird slots are filled, whichever comes first."
  )
  assert.match(split[3].text, /regular rate of \$245\.50 per adult/)
})

test("reminders show only while early-bird adults are unpaid and the due date has not passed", () => {
  const registration = { state: "VIC", is_early_bird: true, early_bird_slot: "melbourne", spouse_attending: true, amount_paid: 220 }
  const before = new Date("2027-01-31T12:00:00+11:00")
  const after = new Date("2027-02-01T09:00:00+11:00")
  assert.equal(showsEarlyBirdReminders(registration, config, before), true)
  assert.equal(showsEarlyBirdReminders({ ...registration, amount_paid: 440 }, config, before), false)
  assert.equal(showsEarlyBirdReminders(registration, config, after), false)
})

test("pricing applies early bird to the first N adults only; children keep their band", () => {
  const attendees = [{ age: 18, isPrimary: true }, { age: 18, isSpouse: true }, { age: 10 }, { age: 40 }]
  assert.equal(calculateTotal({ attendees, earlyBirdSlot: "melbourne" }, config), 220 * 3 + 100)
  assert.equal(calculateTotal({ attendees, earlyBirdSlot: "melbourne", earlyBirdAdultLimit: 1 }, config), 220 + 240 * 2 + 100)
  const notes = buildPricingBreakdown(attendees, "melbourne", [], config, 2).map((item) => item.note)
  assert.deepEqual(notes, ["Early bird — Melbourne slot", "Early bird — Melbourne slot", "Child aged 2–11", "Regular adult rate"])
})
