---
id: features.payment-reconciliation
title: Payment reconciliation (Stripe + CBA CSV)
status: active
synced_commit: working-tree
synced_at: 2026-10-27
owners: [team]
files:
  - src/app/dashboard/payments/reconcile/page.tsx
  - src/app/api/payments/reconcile/route.ts
  - src/app/api/payments/reconcile/recheck/route.ts
  - src/app/api/payments/reconcile/items/route.ts
  - src/app/api/payments/reconciled-amounts/route.ts
  - src/lib/reconciliation/reconciled-amounts.ts
  - src/components/reconciliation/upload-card.tsx
  - src/components/reconciliation/paged-table-card.tsx
  - src/components/reconciliation/reconciliation-tables.tsx
  - src/components/reconciliation/reconciliation-item-dialog.tsx
  - src/components/reconciliation/reconciliation-status-badge.tsx
  - src/components/reconciliation/format.ts
  - src/lib/reconciliation/types.ts
  - src/lib/reconciliation/labels.ts
  - src/lib/reconciliation/parsers.ts
  - src/lib/reconciliation/matching.ts
  - src/lib/reconciliation/ledger.ts
  - src/lib/reconciliation/service.ts
  - src/lib/reconciliation/http.ts
  - src/lib/reconciliation/reconciliation.test.ts
  - src/lib/reconciliation/bank-dedupe.ts
  - src/lib/reconciliation/bank-dedupe.test.ts
  - scripts/db/reverse-duplicate-bank-lines.ts
  - supabase/migrations/025_payment_reconciliation.sql
  - supabase/migrations/026_stripe_bank_settlement.sql
  - scripts/db/lib/cleanup-plan.ts
---

# Payment reconciliation (Stripe + CBA CSV)

## Purpose

Staff with `payments:reconcile` upload the **Stripe balance history** export and the **CBA (CommBank NetBank) statement** export at `/dashboard/payments/reconcile`. Every row is matched to a registered participant (or to a Stripe payout), unmatched rows are reviewed with a comment, and all activity is logged. Replaces the earlier PDF bank-statement upload.

## Behavior

### Page (same look and feel as the Registrations Dashboard)

- "Staff workspace" eyebrow, `Payment Reconciliation` heading with a help tooltip, **Re-check unmatched** and **Refresh** buttons.
- KPI cards: **Matched Stripe** (with unmatched / ignored counts), **Stripe payments in bank** (gross total and count of Stripe payments confirmed received in the CBA account, plus how many are paid out but awaiting the CBA statement, with a **Show** shortcut), **Applied from bank** (total + number of transfers, matched bank lines), **Needs review** (unmatched Stripe + bank rows excluding STRIPE credits awaiting a Stripe export, with a **Show** shortcut that opens the unmatched filter).
- Two upload cards (Stripe, CBA): CSV only, max 5 MB, help tooltip with export instructions, last upload time + file name. Upload button shows a spinner and disables every other action while running.
- After each upload / re-check an alert summarises the run: rows in file, new, already reconciled (skipped), re-checked, matched / unmatched / not applicable, bank payments applied, and Stripe rows newly confirmed as received in the bank.
- Tabs (keyboard arrows supported): **Stripe transactions**, **Bank statement**, **Stripe payouts**, **Run history** (history of reconciliation runs, including an **In bank** column), **Activity log**. Each tab has a search box, filters (Stripe: status, type, **Bank settlement**; Bank: status incl. **Awaiting Stripe export**, kind), a table with sticky first / actions columns and **100 rows per page**.
- Status labels: **Matched Stripe / Unmatched Stripe**, **Matched bank / Unmatched bank**, **Awaiting Stripe export** (STRIPE bank lines only), **Ignored**, **Not applicable**. Rows set by an admin show "Admin set". Hover the status for an explanation.

### Stripe balance history upload

- Expected export: Stripe Dashboard → Balance → Balance history → Export (CSV) including metadata columns `registration_id (metadata)` and `participant_reference (metadata)`. Itemized column names are accepted too. Dates in the file are UTC (d/m/y or ISO).
- Required columns: id, type, amount, net, created, available on. Missing columns → upload rejected with a clear message and recorded as a **failed run**.
- Payments (`charge`, `payment`) match by the `registration_id` metadata, falling back to the Unique Code metadata. When the registration has a recorded Stripe payment of the same amount that is not yet linked, the row links to it (one payment ↔ one row). A registration with no such payment stays **Unmatched** with the reason shown.
- Refunds match the same way (no payment link needed). Payouts, Stripe fees and other balance rows are **Not applicable**.
- Stripe rows **never** change Amount paid; Stripe payments are recorded by the Stripe webhook (`features.registration-workflow-v2`).

### CBA bank statement upload

- Expected export: NetBank → account → Export → CSV (`Date, Amount, Description, Balance`, with or without a header row, `$` and thousand separators allowed).
- Each line is classified: negative amount → **Money out** (Not applicable); description containing `STRIPE` → **Stripe payout**; otherwise **Bank transfer**.
- **Bank transfers** match a registration when the description contains exactly one registration's Unique Code or registration number (case, spaces, `_` and `-` ignored, e.g. `VIC_SMITH_001`, `VIC SMITH 001`, `VICSMITH001`), the longest code wins when one code contains another, and the transaction date is **on or after** the registration date (Melbourne time), since Unique Codes can be reused. Zero or several candidates → Unmatched with the reason.
- A matched transfer is **applied automatically**: a `payments` row (`source = bank_reconcile`, linked to the bank line) is inserted, Amount paid and payment status are updated (`payment_last_updated_source = bank_reconcile`), audit `payment.record` is written, and the **Payment received** email is sent once per registration after the run.
- **Stripe payouts**: a Stripe payout covers the Stripe rows whose **Available On** time is after the previous payout's created time and up to this payout's created time. The bank Direct Credit from STRIPE matches the payout with the same amount when the bank date is between 1 day before and 7 days after the payout's Melbourne date (closest wins). Ties → Unmatched. Each payout can match one bank line only.
- The **Stripe payouts** tab shows each payout's row count, rows net, the difference (≠ $0.00 means rows are missing from the uploads) and whether it was received in the bank.

### Upload order (any order)

- The Stripe and CBA exports can be uploaded in **any order**, any number of times; the result is the same.
- **Bank first**: a STRIPE Direct Credit with no matching payout stays Unmatched. When the stored Stripe exports do not cover its date (no Stripe row at least 7 days before it, or the latest Stripe row is before it) it shows **Awaiting Stripe export** with the reason "Waiting for the Stripe balance history covering {date}…" and is **not** counted in Needs review. When the exports do cover the date it is a real **Unmatched bank** line ("No Stripe payout of $X found…").
- Every Stripe upload re-checks stored Unmatched STRIPE bank lines, so a waiting Direct Credit is matched to its payout as soon as the Stripe export arrives. Every bank upload re-checks all stored Unmatched lines.
- **Bank settlement** is stored on each Stripe row after every run (and after an override of a STRIPE bank line): the payout that paid it out (`payout_id`), the matched CBA line (`bank_line_id`) and the bank date (`bank_received_date`). It is recomputed from all stored rows, so it does not depend on upload order.
- Stripe rows show **Bank settlement**: **Received in bank {date}** (with the payout id), **Paid out, awaiting bank statement** (payout known, Direct Credit not uploaded or not matched yet) or **Not paid out yet**.
- A Stripe row becoming received logs **Received in bank** (`bank_confirmed`); losing it (the bank line is overridden or ignored) logs **Bank confirmation removed** (`bank_unconfirmed`). Runs count newly confirmed rows (`bank_confirmed`).

### Re-running / efficiency

- Stripe rows are keyed by the Stripe transaction id; bank lines by a fingerprint (date, amount, description, balance, occurrence in the file). Uploading overlapping files is safe: known rows are not inserted again.
  - CBA has two CSV exports for the same account: the statement export (with a Balance column) and the transaction-history export (no Balance column), so the same transaction gets different fingerprints. A line with a new fingerprint is also compared by **date + amount + description** (case and spacing ignored, `src/lib/reconciliation/bank-dedupe.ts`): per combination, only as many lines are inserted as the file has beyond what is already stored, so re-importing days covered by another export never applies a payment twice, while two identical transfers on the same day in one file still both count. Lines skipped this way are counted in the run's skipped rows.
  - **Clean-up of earlier duplicates:** `npm run db:reverse-duplicate-bank-lines -- --actor <admin email>` lists stored lines that repeat a transaction from an earlier import (per date + amount + description, the real count is the most any single import contained; the earliest-imported lines are kept) and the payments each would reverse, with every registration's amount paid / status before → after. Nothing is written without `--apply`, which marks each duplicate **Ignored** through the same path as the admin override (negative payment row, recalculated amount paid / status, reconciliation events, audit rows; no emails).
- Rows already **Matched**, **Ignored**, **Not applicable** or **admin set** are skipped (counted as "skipped"). Only stored **Unmatched** rows without an admin override are re-checked on each upload or with **Re-check unmatched**.
- One run at a time: a second upload while a run is processing returns **409**.

### Ignore / override

- **Ignore** (Unmatched rows) and **Override** (any row) open a dialog with the row details, current status and reason, full item history, and a **required comment** (min 3 characters).
- Override lets the admin choose any status. Matched requires a participant for Stripe payments / refunds and bank transfers (searchable picker), or a free Stripe payout for STRIPE bank lines.
- Bank transfers: moving away from Matched (or to a different participant) **reverses** the applied payment (negative `payments` row, Amount paid lowered, audit `payment.reconcile_reversed`); matching applies the payment and sends the Payment received email. The dialog warns before saving.
- Overrides set `manual_override`, the comment, who and when; automatic matching never changes these rows again.

### Logging

- Every run is stored (`reconciliation_runs`: source, file name + SHA-256, counters, error, who, when).
- Every row change writes `reconciliation_events` (imported, re-checked, ignored, status overridden, payment applied / reversed / failed, received in bank / bank confirmation removed, run completed / failed) with from / to status, amount, comment and actor.
- Audit log: `payment.reconcile_run`, `payment.reconcile_run_failed`, `payment.reconcile_override`, plus `payment.record` / `payment.reconcile_reversed` for ledger changes.

### Reconciled amount per registration

- `GET /api/payments/reconciled-amounts` (`registrations:read_all`) returns, per registration, the money confirmed in the bank: `bank` (bank-reconcile payments, reversals included), `stripeNet` (net of Matched Stripe payments / refunds whose payout has a bank line) and `stripeFees`. Used by the Registrations Dashboard **Reconciled in bank** card (`features.dashboard`).

## Acceptance criteria

- [ ] Page shows run history and an activity log
- [ ] Stripe upload matches rows to participants and shows Matched Stripe / Unmatched Stripe
- [ ] Unmatched rows can be ignored only with a comment
- [ ] Any row's status can be overridden only with a comment; changes are logged
- [ ] Re-uploading or re-checking skips Matched / Ignored / Not applicable / admin-set rows
- [ ] CBA upload matches transfers by Unique Code / registration number and applies the payment automatically (Amount paid, status, Payment received email)
- [ ] STRIPE Direct Credits match Stripe payouts (rows after the previous payout up to this payout)
- [ ] Exports can be uploaded in any order: a bank statement uploaded first keeps STRIPE credits as Awaiting Stripe export, and the later Stripe upload confirms those Stripe payments as Received in bank
- [ ] Each Stripe row shows its bank settlement (received / awaiting bank statement / not paid out)
- [ ] Tooltips explain exports, payouts, re-check, ignore and override
- [ ] Layout mirrors the Registrations Dashboard (header, KPI cards, search, filters, table, 100/page)
- [ ] All actions show a spinner and disable their trigger while running

## Out of scope

- Creating Stripe payments from the CSV (the webhook records them).
- Other banks' CSV formats; PDF statements.
- Editing amounts of imported rows.

## Related specs

- `features.dashboard`
- `features.payment`
- `features.registration-workflow-v2`
- `features.audit`
- `global.database`
- `global.email`

## Notes for Cursor / implementers

- Pure parsing / matching live in `parsers.ts` / `matching.ts` and are covered by `reconciliation.test.ts` (`npx tsx --test src/lib/reconciliation/reconciliation.test.ts`). Fixtures are anonymised; never commit real payer data.
- Keep FK directions `payments → bank_statement_lines` and `stripe_balance_transactions → bank_statement_lines / payments` only (the backup tool rejects FK cycles). New tables are cleared by go-live cleanup (Stripe rows before bank lines).
- Settlement logic is the pure `computeStripeSettlement` / `matchBankPayoutLine(…, coverage)` in `matching.ts`; `syncStripeSettlement` in `service.ts` persists it.
