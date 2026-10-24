import assert from "node:assert/strict"
import test from "node:test"

import { buildReportsSummary } from "./reports-summary"

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

  assert.deepEqual(summary.VIC, { registrations: 2, registrants: 2, spouses: 1, additionalAdults: 3, kids: 2, people: 8 })
  assert.deepEqual(summary.NSW, { registrations: 1, registrants: 1, spouses: 1, additionalAdults: 0, kids: 1, people: 3 })
  assert.equal(totals.people, 11)
  assert.equal(totals.additionalAdults, 3)
  assert.equal(totals.amount_remaining, 1420)
})
