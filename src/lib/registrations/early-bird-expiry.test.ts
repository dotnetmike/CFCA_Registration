import assert from "node:assert/strict"
import test from "node:test"

import { DEFAULT_PRICING_CONFIG } from "@/lib/pricing/calculate"
import { planEarlyBirdExpiry, type EarlyBirdExpiryCandidate } from "./early-bird-expiry"

const config = {
  ...DEFAULT_PRICING_CONFIG,
  earlyBirdStart: "2026-10-01",
  earlyBirdEnd: "2027-01-31",
  earlyBirdPaymentDueDate: "2027-01-31",
  earlyBirdVicLimit: 4,
  earlyBirdInterstateLimit: 200,
}
const beforeDue = new Date("2026-11-01T00:00:00Z")
const afterDue = new Date("2027-02-01T00:00:00Z")

const registration = (overrides: Partial<EarlyBirdExpiryCandidate>): EarlyBirdExpiryCandidate => ({
  id: "id",
  registration_no: "CFCA27-TEST",
  state: "VIC",
  is_early_bird: true,
  early_bird_slot: "melbourne",
  spouse_attending: true,
  registration_attendees: [],
  amount_due: 440,
  amount_paid: 0,
  payment_status: "pending",
  ...overrides,
})

test("nothing changes before the due date while the pool has room", () => {
  const changes = planEarlyBirdExpiry([registration({}), registration({ id: "b", amount_paid: 440, payment_status: "paid" })], config, {
    now: beforeDue,
    canStorePartial: true,
  })
  assert.equal(changes.length, 0)
})

test("after the due date unpaid adults move to the regular rate and paid adults keep early bird", () => {
  const changes = planEarlyBirdExpiry(
    [
      registration({ id: "unpaid" }),
      registration({
        id: "part",
        registration_no: "CFCA27-000011",
        registration_attendees: [{ age: 95 }, { age: 90 }, { age: 80 }],
        amount_due: 1100,
        amount_paid: 220,
        payment_status: "partial",
      }),
      registration({ id: "paid", amount_paid: 440, payment_status: "paid" }),
    ],
    config,
    { now: afterDue, canStorePartial: true }
  )
  assert.deepEqual(
    changes.map((c) => [c.id, c.reason, c.before.amountDue, c.after.amountDue, c.after.paymentStatus, c.after.earlyBirdAdultLimit, c.adultsMoved]),
    [
      ["unpaid", "payment_due_passed", 440, 480, "pending", null, 2],
      ["part", "payment_due_passed", 1100, 220 + 240 * 4, "partial", 1, 4],
    ]
  )
  assert.equal(changes[0].after.isEarlyBird, false)
  assert.equal(changes[1].after.earlyBirdSlot, "melbourne")
})

test("when confirmed adults fill the pool, unpaid adults in that pool lose early bird before the due date", () => {
  const changes = planEarlyBirdExpiry(
    [
      registration({ id: "paid-1", amount_paid: 440, payment_status: "paid" }),
      registration({ id: "paid-2", amount_paid: 440, payment_status: "paid" }),
      registration({ id: "unpaid-vic" }),
      registration({ id: "unpaid-nsw", state: "NSW", early_bird_slot: "interstate" }),
    ],
    config,
    { now: beforeDue, canStorePartial: true }
  )
  assert.deepEqual(changes.map((c) => [c.id, c.reason]), [["unpaid-vic", "capacity_reached"]])
})

test("without the limit column, part-confirmed registrations are left alone", () => {
  const changes = planEarlyBirdExpiry(
    [registration({ id: "part", amount_paid: 220, payment_status: "partial" }), registration({ id: "unpaid" })],
    config,
    { now: afterDue, canStorePartial: false }
  )
  assert.deepEqual(changes.map((c) => c.id), ["unpaid"])
})

test("rerunning after the change is applied finds nothing", () => {
  const changes = planEarlyBirdExpiry(
    [
      registration({ id: "done", is_early_bird: false, early_bird_slot: "none", amount_due: 480 }),
      registration({ id: "part-done", early_bird_adult_limit: 1, amount_due: 460, amount_paid: 220, payment_status: "partial" }),
    ],
    config,
    { now: afterDue, canStorePartial: true }
  )
  assert.equal(changes.length, 0)
})
