import assert from "node:assert/strict"
import test from "node:test"

import { DEFAULT_PRICING_CONFIG } from "@/lib/pricing/calculate"
import { planRegistrationRepricing, type RepriceCandidate } from "./reprice"

const registration = (overrides: Partial<RepriceCandidate>): RepriceCandidate => ({
  id: "reg-1",
  registration_no: "CFCA27-000001",
  given_name: "Test",
  surname: "Person",
  spouse_attending: false,
  souvenir_orders: [],
  is_early_bird: true,
  early_bird_slot: "melbourne",
  amount_due: 220,
  amount_paid: 220,
  payment_status: "paid",
  registration_attendees: [],
  ...overrides,
})

test("re-prices adult attendees and moves a paid registration to part paid", () => {
  const [change] = planRegistrationRepricing(
    [registration({ amount_due: 920, registration_attendees: [{ age: 95 }, { age: 94 }, { age: 90 }, { age: 80 }] })],
    DEFAULT_PRICING_CONFIG
  )
  assert.equal(change.before.amountDue, 920)
  assert.equal(change.after.amountDue, 1100)
  assert.equal(change.after.balance, 880)
  assert.equal(change.before.paymentStatus, "paid")
  assert.equal(change.after.paymentStatus, "partial")
})

test("skips registrations whose stored fee already matches", () => {
  const changes = planRegistrationRepricing(
    [
      registration({}),
      registration({ id: "reg-2", amount_due: 440, is_early_bird: false, early_bird_slot: "none", amount_paid: 0, payment_status: "pending", registration_attendees: [{ age: 12 }, { age: 5 }, { age: 0 }] }),
      registration({ id: "reg-3", amount_due: 515, is_early_bird: false, early_bird_slot: "none", amount_paid: 0, payment_status: "pending", registration_attendees: [{ age: 13 }, { age: 11 }, { age: 1 }] }),
    ],
    DEFAULT_PRICING_CONFIG
  )
  assert.equal(changes.length, 1)
  assert.equal(changes[0].id, "reg-2")
  assert.equal(changes[0].after.amountDue, 515)
  assert.equal(changes[0].after.paymentStatus, "pending")
})
