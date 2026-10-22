"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/pricing/calculate"
import {
  BANK_LINE_KIND_LABELS,
  BANK_SETTLEMENT_LABELS,
  ITEM_TYPE_LABELS,
  RECONCILIATION_HELP,
  RECONCILIATION_STATUS_LABELS,
  RUN_SOURCE_LABELS,
  formatReconciliationAction,
} from "@/lib/reconciliation/labels"
import type {
  BankLineView,
  ReconciliationEventView,
  ReconciliationRunView,
  ReconciliationStatus,
  RegistrationOption,
  StripePayoutView,
  StripeTransactionView,
} from "@/lib/reconciliation/types"
import { ReconciliationStatusBadge } from "@/components/reconciliation/reconciliation-status-badge"
import { EmptyRow, PagedTableCard, paginate } from "@/components/reconciliation/paged-table-card"
import { formatCalendarDate, formatDateTime } from "@/components/reconciliation/format"
import type { DialogMode, DialogTarget } from "@/components/reconciliation/reconciliation-item-dialog"

type RegistrationLookup = Map<string, RegistrationOption>

type PagedProps<T> = {
  rows: T[]
  totalLoaded: number
  page: number
  onPageChange: (page: number) => void
}

type ActionProps = {
  registrationsById: RegistrationLookup
  onAction: (mode: DialogMode, target: DialogTarget) => void
}

const linkClass = "font-semibold text-accent-ink underline-offset-4 hover:text-ink hover:underline"
const actionButtonClass = "h-8 shrink-0 px-2.5 text-xs"

const tableTitle = (count: number, totalLoaded: number, noun: string) =>
  count === totalLoaded ? `${count} ${noun}` : `${count} matching (of ${totalLoaded} loaded)`

const Dash = () => <span className="text-ink-soft/50">—</span>

const RegistrationLink = ({
  registrationId,
  registrationsById,
}: {
  registrationId: string | null
  registrationsById: RegistrationLookup
}) => {
  if (!registrationId) return <Dash />
  const registration = registrationsById.get(registrationId)
  if (!registration) return <span className="text-xs text-ink-soft">Deleted registration</span>
  return (
    <span className="block">
      <Link href={`/dashboard/registrations/${registration.id}`} className={linkClass}>
        {registration.registrationNo}
      </Link>
      <span className="block text-xs text-ink-soft">{registration.name}</span>
    </span>
  )
}

const ReasonCell = ({
  reason,
  comment,
  updatedBy,
  updatedAt,
}: {
  reason: string
  comment: string
  updatedBy: string | null
  updatedAt: string | null
}) => (
  <div className="max-w-[22rem] space-y-0.5 text-xs">
    {reason ? <p className="text-ink">{reason}</p> : <Dash />}
    {comment ? <p className="italic text-ink-soft">“{comment}”</p> : null}
    {updatedBy && updatedAt ? (
      <p className="text-ink-soft/80">
        {updatedBy} · {formatDateTime(updatedAt)}
      </p>
    ) : null}
  </div>
)

const RowActions = ({
  status,
  label,
  target,
  onAction,
}: {
  status: ReconciliationStatus
  label: string
  target: DialogTarget
  onAction: ActionProps["onAction"]
}) => (
  <div className="flex flex-nowrap items-center justify-end gap-1.5">
    {status === "unmatched" ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={actionButtonClass}
        onClick={() => onAction("ignore", target)}
        aria-label={`Ignore ${label}`}
        title="Exclude this row (comment required)"
      >
        Ignore
      </Button>
    ) : null}
    <Button
      type="button"
      size="sm"
      className={actionButtonClass}
      onClick={() => onAction("override", target)}
      aria-label={`Override status of ${label}`}
      title="Set the status yourself (comment required)"
    >
      Override
    </Button>
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={actionButtonClass}
      onClick={() => onAction("history", target)}
      aria-label={`History of ${label}`}
    >
      History
    </Button>
  </div>
)

const BankSettlementCell = ({ row }: { row: StripeTransactionView }) => {
  if (row.bankSettlement === "received") {
    return (
      <>
        <span className="inline-flex whitespace-nowrap rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
          {BANK_SETTLEMENT_LABELS.received} {formatCalendarDate(row.settledBankDate)}
        </span>
        {row.payoutId ? <span className="mt-0.5 block break-all text-ink-soft">{row.payoutId}</span> : null}
      </>
    )
  }
  if (row.bankSettlement === "awaiting_bank") {
    return (
      <>
        <span className="block font-semibold text-amber-800">
          Paid out {formatDateTime(row.payoutCreatedUtc)}
        </span>
        <span className="block text-ink-soft">Awaiting CBA statement</span>
        {row.payoutId ? <span className="block break-all text-ink-soft/80">{row.payoutId}</span> : null}
      </>
    )
  }
  return <span className="text-ink-soft">{BANK_SETTLEMENT_LABELS.not_paid_out}</span>
}

const amountClass = (value: number) =>
  `whitespace-nowrap text-right tabular-nums ${value < 0 ? "text-red-700" : "font-medium"}`

export const StripeTransactionsTable = ({
  rows,
  totalLoaded,
  page,
  onPageChange,
  registrationsById,
  onAction,
}: PagedProps<StripeTransactionView> & ActionProps) => {
  const { pageRows } = paginate(rows, page)
  return (
    <PagedTableCard
      title={tableTitle(rows.length, totalLoaded, "Stripe transactions")}
      tableLabel="Stripe transactions table"
      total={rows.length}
      page={page}
      onPageChange={onPageChange}
      minWidthClass="min-w-[80rem]"
      header={
        <tr>
          <th className="cfca-registrations-table__sticky-left w-[9rem] whitespace-nowrap" scope="col">Created</th>
          <th className="min-w-[10rem]" scope="col">Type</th>
          <th className="min-w-[10rem]" scope="col">Participant</th>
          <th className="w-24 whitespace-nowrap text-right" scope="col">Gross</th>
          <th className="w-20 whitespace-nowrap text-right" scope="col">Fee</th>
          <th className="w-24 whitespace-nowrap text-right" scope="col">Net</th>
          <th className="min-w-[11rem]" scope="col" title={RECONCILIATION_HELP.bankSettlement}>Bank settlement</th>
          <th className="w-32 whitespace-nowrap" scope="col">Status</th>
          <th className="min-w-[16rem]" scope="col">Reason / comment</th>
          <th className="cfca-registrations-table__sticky-right w-[13rem] whitespace-nowrap text-right" scope="col">Actions</th>
        </tr>
      }
    >
      {pageRows.length === 0 ? (
        <EmptyRow colSpan={10} message="No Stripe transactions match the current filters." />
      ) : (
        pageRows.map((row) => {
          const label = `Stripe ${row.type} ${row.stripeTxnId}`
          return (
            <tr key={row.id}>
              <td className="cfca-registrations-table__sticky-left whitespace-nowrap text-xs">
                {formatDateTime(row.createdUtc)}
              </td>
              <td>
                <span className="block font-medium capitalize">{row.type.replace(/_/g, " ")}</span>
                <span className="block break-all text-xs text-ink-soft">{row.stripeTxnId}</span>
              </td>
              <td>
                {row.matchedRegistrationId ? (
                  <RegistrationLink registrationId={row.matchedRegistrationId} registrationsById={registrationsById} />
                ) : row.metadataParticipantReference ? (
                  <span className="text-xs text-ink-soft" title="Unique Code saved on the Stripe payment">
                    {row.metadataParticipantReference}
                  </span>
                ) : (
                  <Dash />
                )}
              </td>
              <td className={amountClass(row.amount)}>{formatCurrency(row.amount)}</td>
              <td className="whitespace-nowrap text-right text-xs tabular-nums text-ink-soft">
                {row.fee ? formatCurrency(row.fee) : "—"}
              </td>
              <td className={amountClass(row.net)}>{formatCurrency(row.net)}</td>
              <td className="text-xs">
                <BankSettlementCell row={row} />
              </td>
              <td>
                <ReconciliationStatusBadge status={row.status} itemType="stripe" manualOverride={row.manualOverride} />
              </td>
              <td>
                <ReasonCell
                  reason={row.statusReason}
                  comment={row.statusComment}
                  updatedBy={row.statusUpdatedByName}
                  updatedAt={row.statusUpdatedAt}
                />
              </td>
              <td className="cfca-registrations-table__sticky-right">
                <RowActions
                  status={row.status}
                  label={label}
                  target={{ itemType: "stripe", item: row }}
                  onAction={onAction}
                />
              </td>
            </tr>
          )
        })
      )}
    </PagedTableCard>
  )
}

export const BankLinesTable = ({
  rows,
  totalLoaded,
  page,
  onPageChange,
  registrationsById,
  onAction,
}: PagedProps<BankLineView> & ActionProps) => {
  const { pageRows } = paginate(rows, page)
  return (
    <PagedTableCard
      title={tableTitle(rows.length, totalLoaded, "bank statement lines")}
      tableLabel="Bank statement table"
      total={rows.length}
      page={page}
      onPageChange={onPageChange}
      minWidthClass="min-w-[80rem]"
      header={
        <tr>
          <th className="cfca-registrations-table__sticky-left w-[7.5rem] whitespace-nowrap" scope="col">Date</th>
          <th className="min-w-[16rem]" scope="col">Description</th>
          <th className="w-24 whitespace-nowrap text-right" scope="col">Amount</th>
          <th className="w-28 whitespace-nowrap" scope="col">Kind</th>
          <th className="min-w-[10rem]" scope="col">Matched to</th>
          <th className="w-24 whitespace-nowrap text-right" scope="col" title="Amount applied to the registration's Amount paid">Applied</th>
          <th className="w-32 whitespace-nowrap" scope="col">Status</th>
          <th className="min-w-[16rem]" scope="col">Reason / comment</th>
          <th className="cfca-registrations-table__sticky-right w-[13rem] whitespace-nowrap text-right" scope="col">Actions</th>
        </tr>
      }
    >
      {pageRows.length === 0 ? (
        <EmptyRow colSpan={9} message="No bank statement lines match the current filters." />
      ) : (
        pageRows.map((row) => {
          const label = `bank line ${row.transactionDate} ${formatCurrency(row.amount)}`
          return (
            <tr key={row.id}>
              <td className="cfca-registrations-table__sticky-left whitespace-nowrap text-xs">
                {formatCalendarDate(row.transactionDate)}
              </td>
              <td className="max-w-[20rem]">
                <span className="block truncate" title={row.description}>{row.description}</span>
              </td>
              <td className={amountClass(row.amount)}>{formatCurrency(row.amount)}</td>
              <td className="whitespace-nowrap text-xs">{BANK_LINE_KIND_LABELS[row.kind]}</td>
              <td className="text-xs">
                {row.kind === "stripe_payout" ? (
                  row.matchedStripePayoutId ? (
                    <span className="break-all text-ink" title="Stripe payout">{row.matchedStripePayoutId}</span>
                  ) : (
                    <Dash />
                  )
                ) : (
                  <RegistrationLink registrationId={row.matchedRegistrationId} registrationsById={registrationsById} />
                )}
              </td>
              <td className="whitespace-nowrap text-right tabular-nums">
                {row.appliedAmount > 0 ? formatCurrency(row.appliedAmount) : <Dash />}
              </td>
              <td>
                <ReconciliationStatusBadge
                  status={row.status}
                  itemType="bank"
                  manualOverride={row.manualOverride}
                  awaitingStripeExport={row.awaitingStripeExport}
                />
              </td>
              <td>
                <ReasonCell
                  reason={row.statusReason}
                  comment={row.statusComment}
                  updatedBy={row.statusUpdatedByName}
                  updatedAt={row.statusUpdatedAt}
                />
              </td>
              <td className="cfca-registrations-table__sticky-right">
                <RowActions
                  status={row.status}
                  label={label}
                  target={{ itemType: "bank", item: row }}
                  onAction={onAction}
                />
              </td>
            </tr>
          )
        })
      )}
    </PagedTableCard>
  )
}

export const PayoutsTable = ({ rows, totalLoaded, page, onPageChange }: PagedProps<StripePayoutView>) => {
  const { pageRows } = paginate(rows, page)
  return (
    <PagedTableCard
      title={tableTitle(rows.length, totalLoaded, "Stripe payouts")}
      tableLabel="Stripe payouts table"
      total={rows.length}
      page={page}
      onPageChange={onPageChange}
      minWidthClass="min-w-[60rem]"
      header={
        <tr>
          <th className="cfca-registrations-table__sticky-left w-[9rem] whitespace-nowrap" scope="col">Payout created</th>
          <th className="min-w-[12rem]" scope="col">Payout</th>
          <th className="w-24 whitespace-nowrap text-right" scope="col">Amount</th>
          <th className="w-24 whitespace-nowrap text-right" scope="col" title="Stripe rows included in this payout">Rows</th>
          <th className="w-28 whitespace-nowrap text-right" scope="col" title="Sum of net amounts of the included rows">Rows net</th>
          <th className="w-28 whitespace-nowrap text-right" scope="col" title="Payout amount minus rows net. $0.00 means every row is uploaded.">Difference</th>
          <th className="min-w-[10rem]" scope="col">CBA Direct Credit</th>
        </tr>
      }
    >
      {pageRows.length === 0 ? (
        <EmptyRow colSpan={7} message="No Stripe payouts yet. Upload a Stripe balance history export." />
      ) : (
        pageRows.map((row) => {
          const isBalanced = Math.abs(row.difference) < 0.005
          return (
            <tr key={row.payoutId}>
              <td className="cfca-registrations-table__sticky-left whitespace-nowrap text-xs">
                {formatDateTime(row.createdUtc)}
              </td>
              <td className="break-all text-xs">{row.payoutId}</td>
              <td className="whitespace-nowrap text-right font-medium tabular-nums">{formatCurrency(row.amount)}</td>
              <td className="whitespace-nowrap text-right tabular-nums">{row.transactionCount}</td>
              <td className="whitespace-nowrap text-right tabular-nums">{formatCurrency(row.coveredNet)}</td>
              <td
                className={`whitespace-nowrap text-right tabular-nums ${isBalanced ? "text-emerald-700" : "font-semibold text-amber-800"}`}
                title={isBalanced ? "All rows for this payout are uploaded" : "Some rows for this payout are missing from the Stripe uploads"}
              >
                {formatCurrency(row.difference)}
              </td>
              <td className="text-xs">
                {row.bankDate ? (
                  <span className="font-semibold text-emerald-700">Received {formatCalendarDate(row.bankDate)}</span>
                ) : (
                  <span className="text-amber-800">Not in bank statement yet</span>
                )}
              </td>
            </tr>
          )
        })
      )}
    </PagedTableCard>
  )
}

export const RunsTable = ({ rows, totalLoaded, page, onPageChange }: PagedProps<ReconciliationRunView>) => {
  const { pageRows } = paginate(rows, page)
  return (
    <PagedTableCard
      title={tableTitle(rows.length, totalLoaded, "reconciliation runs")}
      tableLabel="Reconciliation run history table"
      total={rows.length}
      page={page}
      onPageChange={onPageChange}
      minWidthClass="min-w-[76rem]"
      header={
        <tr>
          <th className="cfca-registrations-table__sticky-left w-[9rem] whitespace-nowrap" scope="col">When</th>
          <th className="min-w-[10rem]" scope="col">Run</th>
          <th className="w-24 whitespace-nowrap" scope="col">Result</th>
          <th className="w-20 whitespace-nowrap text-right" scope="col" title="Rows in the uploaded file">In file</th>
          <th className="w-20 whitespace-nowrap text-right" scope="col" title="Rows not seen in earlier uploads">New</th>
          <th className="w-20 whitespace-nowrap text-right" scope="col" title="Rows already reconciled (Matched, Ignored, Not applicable or admin set) — not processed again">Skipped</th>
          <th className="w-24 whitespace-nowrap text-right" scope="col" title="Previously Unmatched rows matched again">Re-checked</th>
          <th className="w-20 whitespace-nowrap text-right" scope="col">Matched</th>
          <th className="w-24 whitespace-nowrap text-right" scope="col">Unmatched</th>
          <th className="min-w-[8rem] whitespace-nowrap text-right" scope="col" title="Bank transfers applied to registrations">Applied</th>
          <th
            className="w-28 whitespace-nowrap text-right"
            scope="col"
            title="Stripe payments newly confirmed as received in the bank by this run (whichever export was uploaded first)"
          >
            In bank
          </th>
          <th className="min-w-[8rem]" scope="col">By</th>
        </tr>
      }
    >
      {pageRows.length === 0 ? (
        <EmptyRow colSpan={12} message="No reconciliation runs yet. Upload a Stripe or CBA export to start." />
      ) : (
        pageRows.map((run) => (
          <tr key={run.id}>
            <td className="cfca-registrations-table__sticky-left whitespace-nowrap text-xs">
              {formatDateTime(run.createdAt)}
            </td>
            <td>
              <span className="block font-medium">{RUN_SOURCE_LABELS[run.source]}</span>
              {run.filename ? (
                <span className="block max-w-[16rem] truncate text-xs text-ink-soft" title={run.filename}>
                  {run.filename}
                </span>
              ) : null}
              {run.error ? <span className="block text-xs text-red-700">{run.error}</span> : null}
            </td>
            <td className="whitespace-nowrap">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  run.status === "completed"
                    ? "bg-emerald-100 text-emerald-800"
                    : run.status === "failed"
                      ? "bg-red-100 text-red-800"
                      : "bg-sky-100 text-sky-800"
                }`}
              >
                {run.status === "completed" ? "Completed" : run.status === "failed" ? "Failed" : "Processing"}
              </span>
            </td>
            <td className="text-right tabular-nums">{run.rowsInFile}</td>
            <td className="text-right tabular-nums">{run.newRows}</td>
            <td className="text-right tabular-nums">{run.skippedRows}</td>
            <td className="text-right tabular-nums">{run.recheckedRows}</td>
            <td className="text-right tabular-nums text-emerald-700">{run.matched}</td>
            <td className={`text-right tabular-nums ${run.unmatched > 0 ? "font-semibold text-amber-800" : ""}`}>
              {run.unmatched}
            </td>
            <td className="whitespace-nowrap text-right tabular-nums">
              {run.paymentsApplied > 0 ? `${run.paymentsApplied} · ${formatCurrency(run.amountApplied)}` : <Dash />}
            </td>
            <td className="text-right tabular-nums text-emerald-700">{run.bankConfirmed > 0 ? run.bankConfirmed : <Dash />}</td>
            <td className="text-xs">{run.createdByName ?? "—"}</td>
          </tr>
        ))
      )}
    </PagedTableCard>
  )
}

export const ActivityTable = ({
  rows,
  totalLoaded,
  page,
  onPageChange,
  registrationsById,
}: PagedProps<ReconciliationEventView> & Pick<ActionProps, "registrationsById">) => {
  const { pageRows } = paginate(rows, page)
  const statusLabel = (value: string | null) =>
    value ? RECONCILIATION_STATUS_LABELS[value as ReconciliationStatus] ?? value : "New"
  return (
    <PagedTableCard
      title={tableTitle(rows.length, totalLoaded, "recent activity entries")}
      tableLabel="Reconciliation activity log table"
      total={rows.length}
      page={page}
      onPageChange={onPageChange}
      minWidthClass="min-w-[72rem]"
      header={
        <tr>
          <th className="cfca-registrations-table__sticky-left w-[9rem] whitespace-nowrap" scope="col">When</th>
          <th className="min-w-[10rem]" scope="col">Action</th>
          <th className="min-w-[16rem]" scope="col">Item</th>
          <th className="min-w-[9rem]" scope="col">Status change</th>
          <th className="min-w-[9rem]" scope="col">Participant</th>
          <th className="w-24 whitespace-nowrap text-right" scope="col">Amount</th>
          <th className="min-w-[14rem]" scope="col">Comment</th>
          <th className="min-w-[8rem]" scope="col">By</th>
        </tr>
      }
    >
      {pageRows.length === 0 ? (
        <EmptyRow colSpan={8} message="No activity matches the current filters." />
      ) : (
        pageRows.map((event) => (
          <tr key={event.id}>
            <td className="cfca-registrations-table__sticky-left whitespace-nowrap text-xs">
              {formatDateTime(event.createdAt)}
            </td>
            <td className="font-medium">{formatReconciliationAction(event.action)}</td>
            <td className="max-w-[20rem] text-xs">
              {event.itemType ? (
                <span className="mr-1 font-semibold text-ink-soft">{ITEM_TYPE_LABELS[event.itemType]}:</span>
              ) : null}
              <span className="break-words" title={event.itemLabel}>{event.itemLabel}</span>
            </td>
            <td className="whitespace-nowrap text-xs">
              {event.fromStatus || event.toStatus ? `${statusLabel(event.fromStatus)} → ${statusLabel(event.toStatus)}` : <Dash />}
            </td>
            <td className="text-xs">
              <RegistrationLink registrationId={event.registrationId} registrationsById={registrationsById} />
            </td>
            <td className="whitespace-nowrap text-right tabular-nums">
              {event.amount !== null ? formatCurrency(event.amount) : <Dash />}
            </td>
            <td className="max-w-[18rem] text-xs">{event.comment || <Dash />}</td>
            <td className="text-xs">{event.actorName ?? "System"}</td>
          </tr>
        ))
      )}
    </PagedTableCard>
  )
}
