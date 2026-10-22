import assert from "node:assert/strict"
import test from "node:test"

import { parseCbaStatement, parseMoneyToCents, parseStripeBalanceHistory } from "./parsers"
import {
  AWAITING_STRIPE_EXPORT_METHOD,
  assignPayouts,
  buildStripeMatchContext,
  computeStripeSettlement,
  findRegistrationCandidates,
  matchBankPayoutLine,
  matchBankTransferLine,
  matchStripeRow,
  type RegistrationRef,
} from "./matching"

const STRIPE_CSV = `id,Type,Source,Amount,Fee,Net,Currency,Created (UTC),Available On (UTC),registration_id (metadata),participant_reference (metadata)
txn_fee3,stripe_fee,,-0.4,0.04,-0.44,aud,21/10/2026 5:42,21/10/2026 5:42,,
txn_pay8,payment,ch_8,440,7.56,432.44,aud,20/10/2026 22:45,22/10/2026 13:00,reg-8,VIC_EIGHT_002
txn_po2,payout,po_2,-215.8,0,-215.8,aud,20/10/2026 13:04,20/10/2026 13:04,,
txn_pay7,charge,ch_7,220,3.93,216.07,aud,20/10/2026 12:15,21/10/2026 13:00,reg-7,VIC_SEVEN_001
txn_fee2,stripe_fee,,-0.16,0.02,-0.18,aud,20/10/2026 4:55,20/10/2026 4:55,,
txn_fee1,stripe_fee,,-0.08,0.01,-0.09,aud,18/10/2026 5:01,18/10/2026 5:01,,
txn_pay6,payment,ch_6,220,3.93,216.07,aud,17/10/2026 23:10,20/10/2026 13:00,reg-6,VIC_SIX_001
txn_po1,payout,po_1,-7.34,0,-7.34,aud,15/10/2026 13:02,15/10/2026 13:02,,
txn_fee0,stripe_fee,,-0.64,0.06,-0.7,aud,10/10/2026 5:23,10/10/2026 5:23,,
txn_pay5,payment,ch_5,2,0.33,1.67,aud,9/10/2026 13:46,15/10/2026 13:00,deleted-1,VIC_TEST_001
txn_pay4,payment,ch_4,2,0.33,1.67,aud,9/10/2026 13:08,15/10/2026 13:00,deleted-2,VIC_TEST_002
txn_pay3,payment,ch_3,2,0.33,1.67,aud,9/10/2026 12:50,15/10/2026 13:00,deleted-3,VIC_TEST_003
txn_pay2,payment,ch_2,1,0.32,0.68,aud,9/10/2026 11:53,15/10/2026 13:00,deleted-4,VIC_TEST_004
txn_pay1,charge,ch_1,2,0.33,1.67,aud,9/10/2026 11:52,15/10/2026 13:00,deleted-5,VIC_TEST_005
txn_pay0,charge,ch_0,1,0.32,0.68,aud,9/10/2026 11:32,15/10/2026 13:00,deleted-6,VIC_TEST_006
`

const CBA_CSV = `Date,  Amount  ,Payee,  Total  
21/10/2026, $215.80 ,Direct Credit 158824 STRIPE STRIPE-AAAA111," $2,869.99 "
21/10/2026, $220.00 ,Fast Transfer From MS JANE DOE VIC_ALPHA_001 Jane," $2,654.19 "
20/10/2026, $220.00 ,Direct Credit 128594 BRAVO M VIC BRAVO 001," $2,434.19 "
20/10/2026, $440.00 ,Fast Transfer From MRS C OLIVE conf fee 2027 VICCHARLIE001," $1,774.19 "
20/10/2026, $440.00 ,Fast Transfer From MRS D DELTA Qld_delta_001 Qld Delta 001," $1,114.19 "
20/10/2026, $440.00 ,Fast Transfer From MR E ECHO VIC_ECHO_001 VIC-ECHO-001, $674.19 
16/10/2026, $7.34 ,Direct Credit 158824 STRIPE STRIPE-BBBB222, $14.19 
13/10/2026, $1.00 ,Fast Transfer From F FOX conference fee trial VIC_FOX_002, $6.85 
12/10/2026, -$50.00 ,Transfer To Supplier Pty Ltd, $5.85 
`

const registration = (id: string, ref: string, createdAt: string, no = "CFCA27-000000"): RegistrationRef => ({
  id,
  registrationNo: no,
  participantReference: ref,
  createdAt,
})

test("parses money in bank and Stripe formats", () => {
  assert.equal(parseMoneyToCents(" $2,869.99 "), 286999)
  assert.equal(parseMoneyToCents("-215.8"), -21580)
  assert.equal(parseMoneyToCents("(50.00)"), -5000)
  assert.equal(parseMoneyToCents(""), null)
})

test("parses the Stripe balance history export with metadata columns", () => {
  const rows = parseStripeBalanceHistory(STRIPE_CSV)
  assert.equal(rows.length, 15)
  const payment = rows.find((r) => r.stripeTxnId === "txn_pay8")!
  assert.equal(payment.amountCents, 44000)
  assert.equal(payment.netCents, 43244)
  assert.equal(payment.createdUtc, "2026-10-20T22:45:00Z")
  assert.equal(payment.availableOnUtc, "2026-10-22T13:00:00Z")
  assert.equal(payment.metadataParticipantReference, "VIC_EIGHT_002")
  assert.throws(() => parseStripeBalanceHistory("foo,bar\n1,2"), /Stripe balance history/)
})

test("payouts contain rows available after the previous payout and up to the payout", () => {
  const rows = parseStripeBalanceHistory(STRIPE_CSV)
  const { payouts, payoutByTxn } = assignPayouts(rows)
  const [first, second] = payouts
  assert.equal(first.payoutId, "po_1")
  assert.equal(first.amountCents, 734)
  assert.equal(first.coveredNetCents, 734)
  assert.equal(first.transactionCount, 7)
  assert.equal(second.payoutId, "po_2")
  assert.equal(second.amountCents, 21580)
  assert.equal(second.coveredNetCents, 21580)
  assert.equal(second.transactionCount, 3)
  assert.equal(payoutByTxn.get("txn_pay7"), null)
  assert.equal(payoutByTxn.get("txn_pay8"), null)
})

test("matches Stripe payments to registrations and recorded payments", () => {
  const registrations = [
    registration("reg-6", "VIC_SIX_001", "2026-10-17T00:00:00Z"),
    registration("reg-7", "VIC_SEVEN_001", "2026-10-20T00:00:00Z"),
    registration("reg-8", "VIC_EIGHT_002", "2026-10-20T00:00:00Z"),
  ]
  const context = buildStripeMatchContext(
    registrations,
    [
      { id: "pay-6", registrationId: "reg-6", amountCents: 22000 },
      { id: "pay-7", registrationId: "reg-7", amountCents: 22000 },
    ],
    new Set()
  )
  const rows = parseStripeBalanceHistory(STRIPE_CSV)
  const outcome = (id: string) => matchStripeRow(rows.find((r) => r.stripeTxnId === id)!, context)

  const matched = outcome("txn_pay6")
  assert.deepEqual({ status: matched.status, paymentId: matched.paymentId }, { status: "matched", paymentId: "pay-6" })
  assert.equal(outcome("txn_pay6").paymentId, null, "a recorded payment is linked to one Stripe row only")
  const missingPayment = outcome("txn_pay8")
  assert.equal(missingPayment.status, "unmatched")
  assert.equal(missingPayment.registrationId, "reg-8")
  assert.match(missingPayment.reason, /no Stripe payment of \$440.00/)
  assert.equal(outcome("txn_pay5").status, "unmatched")
  assert.match(outcome("txn_pay5").reason, /may have been deleted/)
  assert.equal(outcome("txn_fee0").status, "not_applicable")
  assert.equal(outcome("txn_po1").status, "not_applicable")
})

test("parses the CBA statement and classifies lines", () => {
  const lines = parseCbaStatement(CBA_CSV)
  assert.equal(lines.length, 9)
  assert.deepEqual(
    lines.map((l) => l.kind),
    ["stripe_payout", "transfer", "transfer", "transfer", "transfer", "transfer", "stripe_payout", "transfer", "debit"]
  )
  assert.equal(lines[0].transactionDate, "2026-10-21")
  assert.equal(lines[0].amountCents, 21580)
  assert.equal(lines[0].balanceCents, 286999)
  assert.equal(new Set(lines.map((l) => l.fingerprint)).size, 9)
  assert.deepEqual(
    parseCbaStatement(CBA_CSV).map((l) => l.fingerprint),
    lines.map((l) => l.fingerprint),
    "fingerprints are stable across uploads"
  )
})

test("parses a headerless NetBank export", () => {
  const lines = parseCbaStatement(`21/10/2026,"+220.00","Fast Transfer From X VIC_ALPHA_001","+2654.19"\n`)
  assert.equal(lines.length, 1)
  assert.equal(lines[0].amountCents, 22000)
  assert.equal(lines[0].kind, "transfer")
})

test("matches bank transfers by Unique Code regardless of separators", () => {
  const registrations = [
    registration("a", "VIC_ALPHA_001", "2026-10-19T00:00:00Z"),
    registration("b", "VIC_BRAVO_001", "2026-10-19T00:00:00Z"),
    registration("c", "VIC_CHARLIE_001", "2026-10-19T00:00:00Z"),
    registration("d", "QLD_DELTA_001", "2026-10-19T00:00:00Z"),
    registration("e", "VIC_ECHO_001", "2026-10-19T00:00:00Z"),
    registration("f", "VIC_FOX_002", "2026-10-19T00:00:00Z"),
  ]
  const lines = parseCbaStatement(CBA_CSV)
  const outcomes = lines.filter((l) => l.kind === "transfer").map((l) => matchBankTransferLine(l, registrations))

  assert.deepEqual(
    outcomes.map((o) => [o.status, o.registrationId]),
    [
      ["matched", "a"],
      ["matched", "b"],
      ["matched", "c"],
      ["matched", "d"],
      ["matched", "e"],
      ["unmatched", "f"],
    ]
  )
  assert.match(outcomes[5].reason, /before VIC_FOX_002 registered/)
})

test("flags descriptions that match more than one participant or none", () => {
  const registrations = [
    registration("a", "VIC_ALPHA_001", "2026-10-01T00:00:00Z"),
    registration("b", "VIC_BRAVO_001", "2026-10-01T00:00:00Z"),
  ]
  const both = matchBankTransferLine(
    { transactionDate: "2026-10-20", amountCents: 44000, description: "VIC_ALPHA_001 and VIC_BRAVO_001" },
    registrations
  )
  assert.equal(both.status, "unmatched")
  assert.match(both.reason, /more than one participant/)
  const none = matchBankTransferLine(
    { transactionDate: "2026-10-20", amountCents: 44000, description: "conference fee" },
    registrations
  )
  assert.equal(none.status, "unmatched")
  assert.match(none.reason, /No Unique Code/)
})

test("prefers the longer Unique Code when one contains another", () => {
  const registrations = [
    registration("short", "VIC_LEE_001", "2026-10-01T00:00:00Z"),
    registration("long", "VIC_LEE_0012", "2026-10-01T00:00:00Z"),
  ]
  const hits = findRegistrationCandidates("payment VIC-LEE-0012", registrations)
  assert.deepEqual(hits.map((h) => h.registration.id), ["long"])
})

test("matches Direct Credits from Stripe to the payout of the same amount", () => {
  const { payouts } = assignPayouts(parseStripeBalanceHistory(STRIPE_CSV))
  const lines = parseCbaStatement(CBA_CSV).filter((l) => l.kind === "stripe_payout")
  const taken = new Set<string>()
  const outcomes = lines.map((line) => {
    const outcome = matchBankPayoutLine(line, payouts, taken)
    if (outcome.payoutId) taken.add(outcome.payoutId)
    return outcome
  })
  assert.deepEqual(outcomes.map((o) => [o.status, o.payoutId]), [
    ["matched", "po_2"],
    ["matched", "po_1"],
  ])

  const tooLate = matchBankPayoutLine(
    { transactionDate: "2026-11-30", amountCents: 21580, description: "Direct Credit STRIPE" },
    payouts,
    new Set()
  )
  assert.equal(tooLate.status, "unmatched")
})

test("a STRIPE Direct Credit uploaded before the Stripe export waits for it", () => {
  const line = { transactionDate: "2026-10-21", amountCents: 21580, description: "Direct Credit STRIPE" }
  const noStripeYet = matchBankPayoutLine(line, [], new Set(), { earliestCreatedUtc: null, latestCreatedUtc: null })
  assert.equal(noStripeYet.status, "unmatched")
  assert.equal(noStripeYet.method, AWAITING_STRIPE_EXPORT_METHOD)
  assert.match(noStripeYet.reason, /Waiting for the Stripe balance history/)

  const olderExportOnly = matchBankPayoutLine(line, [], new Set(), {
    earliestCreatedUtc: "2026-09-01T00:00:00Z",
    latestCreatedUtc: "2026-10-10T00:00:00Z",
  })
  assert.equal(olderExportOnly.method, AWAITING_STRIPE_EXPORT_METHOD)

  const coveredButMissing = matchBankPayoutLine(line, [], new Set(), {
    earliestCreatedUtc: "2026-10-01T00:00:00Z",
    latestCreatedUtc: "2026-10-25T00:00:00Z",
  })
  assert.equal(coveredButMissing.method, "")
  assert.match(coveredButMissing.reason, /cover this date/)
})

test("Stripe rows are confirmed received in the bank whichever export is uploaded first", () => {
  const rows = parseStripeBalanceHistory(STRIPE_CSV)
  const bankFirst = computeStripeSettlement(rows, [
    { id: "line-po2", transactionDate: "2026-10-21", payoutId: "po_2" },
    { id: "line-po1", transactionDate: "2026-10-16", payoutId: "po_1" },
  ])
  const stripeFirst = computeStripeSettlement([...rows].reverse(), [
    { id: "line-po1", transactionDate: "2026-10-16", payoutId: "po_1" },
    { id: "line-po2", transactionDate: "2026-10-21", payoutId: "po_2" },
  ])
  assert.deepEqual([...bankFirst.entries()].sort(), [...stripeFirst.entries()].sort())

  assert.deepEqual(bankFirst.get("txn_pay6"), { payoutId: "po_2", bankLineId: "line-po2", bankDate: "2026-10-21" })
  assert.deepEqual(bankFirst.get("txn_po1"), { payoutId: "po_1", bankLineId: "line-po1", bankDate: "2026-10-16" })
  assert.deepEqual(bankFirst.get("txn_pay8"), { payoutId: "", bankLineId: null, bankDate: null })

  const payoutNotInBank = computeStripeSettlement(rows, [])
  assert.deepEqual(payoutNotInBank.get("txn_pay6"), { payoutId: "po_2", bankLineId: null, bankDate: null })
})
