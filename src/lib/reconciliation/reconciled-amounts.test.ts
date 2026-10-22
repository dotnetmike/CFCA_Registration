import assert from "node:assert/strict"
import test from "node:test"

import { summarizeReconciledAmounts } from "./reconciled-amounts"

const stripeRow = (overrides: Partial<Parameters<typeof summarizeReconciledAmounts>[1][number]>) => ({
  registrationId: "reg-a",
  type: "charge",
  net: 212.32,
  fee: 7.68,
  status: "matched",
  bankLineId: "bank-1",
  ...overrides,
})

test("sums bank transfers including reversals per registration", () => {
  const amounts = summarizeReconciledAmounts(
    [
      { registrationId: "reg-a", amount: "220.00" },
      { registrationId: "reg-a", amount: -220 },
      { registrationId: "reg-a", amount: 220 },
      { registrationId: "reg-b", amount: 110.1 },
    ],
    []
  )
  assert.deepEqual(amounts["reg-a"], { bank: 220, stripeNet: 0, stripeFees: 0 })
  assert.deepEqual(amounts["reg-b"], { bank: 110.1, stripeNet: 0, stripeFees: 0 })
})

test("counts only matched Stripe payments and refunds that reached the bank, after fees", () => {
  const amounts = summarizeReconciledAmounts(
    [{ registrationId: "reg-a", amount: 100 }],
    [
      stripeRow({}),
      stripeRow({ type: "refund", net: -50, fee: 0 }),
      stripeRow({ bankLineId: null, net: 999 }),
      stripeRow({ status: "needs_review", net: 999 }),
      stripeRow({ registrationId: null, net: 999 }),
      stripeRow({ type: "payout", net: -212.32, fee: 0 }),
    ]
  )
  assert.deepEqual(amounts["reg-a"], { bank: 100, stripeNet: 162.32, stripeFees: 7.68 })
})
