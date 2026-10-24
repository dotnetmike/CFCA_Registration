import assert from "node:assert/strict"
import test from "node:test"

import { DEFAULT_PRICING_CONFIG, buildPricingBreakdown, priceForAttendee } from "./calculate"

test("prices additional attendees by age band", () => {
  const price = (age: number, slot: "interstate" | "melbourne" | "none" = "none") =>
    priceForAttendee({ age }, slot, DEFAULT_PRICING_CONFIG)

  assert.equal(price(0), 0)
  assert.equal(price(1), 0)
  assert.equal(price(2), 100)
  assert.equal(price(11), 100)
  assert.equal(price(12), 175)
  assert.equal(price(17), 175)
  assert.equal(price(18), 240)
  assert.equal(price(95), 240)
  assert.equal(price(18, "melbourne"), 220)
  assert.equal(price(17, "melbourne"), 175)
})

test("registrant and spouse always pay the adult rate", () => {
  assert.equal(priceForAttendee({ age: 18, isPrimary: true }, "interstate"), 220)
  assert.equal(priceForAttendee({ age: 18, isSpouse: true }, "none"), 240)
})

test("breakdown labels adult attendees with early bird savings", () => {
  const [adult, youth, child, infant] = buildPricingBreakdown(
    [{ age: 80 }, { age: 12 }, { age: 11 }, { age: 1 }],
    "interstate",
    []
  )
  assert.equal(adult.amount, 220)
  assert.equal(adult.earlyBirdSaving, 20)
  assert.equal(youth.note, "Child aged 12–17")
  assert.equal(child.note, "Child aged 2–11")
  assert.equal(infant.amount, 0)
})
