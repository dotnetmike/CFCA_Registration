import assert from "node:assert/strict"
import test from "node:test"

import { DEFAULT_PRICING_CONFIG } from "@/lib/pricing/calculate"
import { buildEarlyBirdUsage, buildReportsSummary } from "./reports-summary"

test("early bird usage counts paid adults per state against the VIC and interstate caps", () => {
  const vic = { state: "VIC", is_early_bird: true, early_bird_slot: "melbourne" }
  const interstate = { is_early_bird: true, early_bird_slot: "interstate" }
  const usage = buildEarlyBirdUsage(
    [
      { ...vic, spouse_attending: true, amount_paid: 440 },
      { ...vic, spouse_attending: true, registration_attendees: [{ age: 40 }, { age: 9 }], amount_paid: 220 },
      { state: "VIC", is_early_bird: false, early_bird_slot: "none", amount_paid: 240 },
      { ...interstate, state: "NSW", spouse_attending: true, amount_paid: 615 },
      { ...interstate, state: "WA", amount_paid: 0 },
      { ...interstate, state: null, amount_paid: 220 },
    ],
    { ...DEFAULT_PRICING_CONFIG, earlyBirdVicLimit: 4, earlyBirdInterstateLimit: 5, earlyBirdEnd: "2027-03-31" },
    new Date("2026-10-24T00:00:00Z")
  )

  assert.deepEqual(usage.pools, [
    { id: "melbourne", label: "Victoria", capacity: 4, used: 3, reserved: 2, remaining: 1 },
    { id: "interstate", label: "Interstate (all other states)", capacity: 5, used: 2, reserved: 1, remaining: 3 },
  ])
  assert.deepEqual(usage.states.find((row) => row.state === "NSW"), { state: "NSW", pool: "interstate", used: 2, reserved: 0 })
  assert.deepEqual(usage.states.find((row) => row.state === "WA"), { state: "WA", pool: "interstate", used: 0, reserved: 1 })
  assert.equal(usage.states.find((row) => row.state === "QLD")?.used, 0)
  assert.equal(usage.states.length, 8)
  assert.equal(usage.windowEnd, "2027-02-28")
  assert.equal(usage.paymentDueDate, "2027-02-28")
  assert.equal(usage.isOpen, true)
})

test("counts registrants, spouses, additional adults and kids in every total", () => {
  const { summary, totals } = buildReportsSummary([
    {
      state: "VIC",
      spouse_attending: false,
      payment_status: "partial",
      amount_due: 1100,
      amount_paid: 220,
      registration_attendees: [{ age: 95 }, { age: 94 }, { age: 18 }, { age: 17 }, { age: 0 }],
    },
    { state: "VIC", spouse_attending: true, payment_status: "paid", amount_due: 440, amount_paid: 440, registration_attendees: [] },
    { state: "NSW", spouse_attending: true, payment_status: "pending", amount_due: 540, amount_paid: 0, registration_attendees: [{ age: 5 }] },
  ])

  assert.deepEqual(summary.VIC, {
    registrations: 2,
    registrants: 2,
    spouses: 1,
    additionalAdults: 3,
    kids: 2,
    teens: 1,
    children: 0,
    infants: 1,
    people: 8,
  })
  assert.deepEqual(summary.NSW, {
    registrations: 1,
    registrants: 1,
    spouses: 1,
    additionalAdults: 0,
    kids: 1,
    teens: 0,
    children: 1,
    infants: 0,
    people: 3,
  })
  assert.equal(totals.people, 11)
  assert.equal(totals.additionalAdults, 3)
  assert.equal(totals.amount_remaining, 1420)
})
