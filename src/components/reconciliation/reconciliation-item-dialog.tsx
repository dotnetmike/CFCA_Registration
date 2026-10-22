"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { useAuth } from "@/lib/auth/context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert } from "@/components/ui/alert"
import { HelpTooltip } from "@/components/ui/help-tooltip"
import { formatCurrency } from "@/lib/pricing/calculate"
import { formatPaymentStatus } from "@/lib/payments/labels"
import { classifyStripeType } from "@/lib/reconciliation/matching"
import {
  BANK_LINE_KIND_LABELS,
  RECONCILIATION_HELP,
  RECONCILIATION_STATUS_HELP,
  RECONCILIATION_STATUS_LABELS,
  formatReconciliationAction,
} from "@/lib/reconciliation/labels"
import {
  RECONCILIATION_STATUSES,
  type BankLineView,
  type ReconciliationEventView,
  type ReconciliationStatus,
  type RegistrationOption,
  type StripePayoutView,
  type StripeTransactionView,
} from "@/lib/reconciliation/types"
import {
  ReconciliationStatusBadge,
  getStatusLabel,
} from "@/components/reconciliation/reconciliation-status-badge"
import { formatCalendarDate, formatDateTime } from "@/components/reconciliation/format"

export type DialogTarget =
  | { itemType: "stripe"; item: StripeTransactionView }
  | { itemType: "bank"; item: BankLineView }

export type DialogMode = "ignore" | "override" | "history"

type ReconciliationItemDialogProps = {
  mode: DialogMode
  target: DialogTarget
  registrations: RegistrationOption[]
  payouts: StripePayoutView[]
  onClose: () => void
  onSaved: (message: string) => void
}

const MIN_COMMENT_LENGTH = 3
const MAX_REGISTRATION_OPTIONS = 50

const selectClass =
  "flex h-10 w-full rounded-md border border-[color:var(--line-strong)] bg-mist/80 px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] disabled:cursor-not-allowed disabled:opacity-50"

const textareaClass =
  "flex min-h-[5.5rem] w-full rounded-md border border-[color:var(--line-strong)] bg-mist/80 px-3 py-2 text-sm text-ink placeholder:text-ink-soft/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] disabled:cursor-not-allowed disabled:opacity-50"

const DIALOG_TITLES: Record<DialogMode, string> = {
  ignore: "Ignore row",
  override: "Override reconciliation status",
  history: "Reconciliation history",
}

const registrationLabel = (r: RegistrationOption) =>
  [r.registrationNo, r.name, r.participantReference, formatPaymentStatus(r.paymentStatus)]
    .filter(Boolean)
    .join(" · ")

const ItemSummary = ({ target }: { target: DialogTarget }) => {
  if (target.itemType === "stripe") {
    const { item } = target
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-ink-soft">Stripe row</dt>
        <dd className="break-all font-medium text-ink">{item.type} · {item.stripeTxnId}</dd>
        <dt className="text-ink-soft">Created</dt>
        <dd>{formatDateTime(item.createdUtc)}</dd>
        <dt className="text-ink-soft">Gross / net</dt>
        <dd className="tabular-nums">{formatCurrency(item.amount)} / {formatCurrency(item.net)}</dd>
        {item.metadataParticipantReference || item.metadataRegistrationId ? (
          <>
            <dt className="text-ink-soft">Stripe metadata</dt>
            <dd className="break-all">
              {[item.metadataParticipantReference, item.metadataRegistrationId].filter(Boolean).join(" · ")}
            </dd>
          </>
        ) : null}
      </dl>
    )
  }
  const { item } = target
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      <dt className="text-ink-soft">Bank line</dt>
      <dd className="break-words font-medium text-ink">{item.description}</dd>
      <dt className="text-ink-soft">Date</dt>
      <dd>{formatCalendarDate(item.transactionDate)}</dd>
      <dt className="text-ink-soft">Amount</dt>
      <dd className="tabular-nums">{formatCurrency(item.amount)}</dd>
      <dt className="text-ink-soft">Kind</dt>
      <dd>{BANK_LINE_KIND_LABELS[item.kind]}</dd>
      {item.appliedAmount > 0 ? (
        <>
          <dt className="text-ink-soft">Applied</dt>
          <dd className="tabular-nums">{formatCurrency(item.appliedAmount)}</dd>
        </>
      ) : null}
    </dl>
  )
}

const HistoryList = ({
  events,
  isLoading,
  error,
}: {
  events: ReconciliationEventView[]
  isLoading: boolean
  error: string
}) => {
  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-soft" role="status">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
        Loading history...
      </p>
    )
  }
  if (error) return <p className="text-sm text-red-600" role="alert">{error}</p>
  if (events.length === 0) return <p className="text-sm text-ink-soft">No activity recorded yet.</p>

  return (
    <ol className="space-y-2">
      {events.map((event) => (
        <li key={event.id} className="rounded-md border border-[color:var(--line)] bg-surface px-3 py-2 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-semibold text-ink">{formatReconciliationAction(event.action)}</span>
            <span className="text-xs text-ink-soft">
              {formatDateTime(event.createdAt)} · {event.actorName ?? "System"}
            </span>
          </div>
          {event.fromStatus || event.toStatus ? (
            <p className="text-xs text-ink-soft">
              {event.fromStatus ? RECONCILIATION_STATUS_LABELS[event.fromStatus as ReconciliationStatus] ?? event.fromStatus : "New"}
              {" → "}
              {event.toStatus ? RECONCILIATION_STATUS_LABELS[event.toStatus as ReconciliationStatus] ?? event.toStatus : "—"}
              {event.amount !== null ? ` · ${formatCurrency(event.amount)}` : ""}
            </p>
          ) : event.amount !== null ? (
            <p className="text-xs text-ink-soft">{formatCurrency(event.amount)}</p>
          ) : null}
          {event.comment ? <p className="mt-1 text-ink">“{event.comment}”</p> : null}
        </li>
      ))}
    </ol>
  )
}

const DialogFrame = ({
  onOpenChange,
  children,
}: {
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) => (
  <Dialog.Root open onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 grid place-items-start overflow-y-auto bg-ink/40 p-4 sm:place-items-center">
        {children}
      </Dialog.Overlay>
    </Dialog.Portal>
  </Dialog.Root>
)

export const ReconciliationItemDialog = ({
  mode,
  target,
  registrations,
  payouts,
  onClose,
  onSaved,
}: ReconciliationItemDialogProps) => {
  const { authFetch } = useAuth()
  const dialogRef = useRef<HTMLDivElement>(null)
  const { item, itemType } = target
  const [status, setStatus] = useState<ReconciliationStatus>(mode === "ignore" ? "ignored" : item.status)
  const [registrationId, setRegistrationId] = useState(item.matchedRegistrationId ?? "")
  const [payoutId, setPayoutId] = useState(
    target.itemType === "bank" ? target.item.matchedStripePayoutId ?? "" : ""
  )
  const [registrationFilter, setRegistrationFilter] = useState("")
  const [comment, setComment] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [history, setHistory] = useState<ReconciliationEventView[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState("")

  const isEditable = mode !== "history"
  const isStripePaymentLike =
    target.itemType === "stripe" && ["payment", "refund"].includes(classifyStripeType(target.item.type))
  const isBankTransfer = target.itemType === "bank" && target.item.kind === "transfer"
  const isBankPayout = target.itemType === "bank" && target.item.kind === "stripe_payout"
  const needsRegistration = isEditable && status === "matched" && (isStripePaymentLike || isBankTransfer)
  const needsPayout = isEditable && status === "matched" && isBankPayout

  const registrationsById = useMemo(
    () => new Map(registrations.map((r) => [r.id, r])),
    [registrations]
  )

  const registrationOptions = useMemo(() => {
    const needle = registrationFilter.trim().toLowerCase()
    const matches = registrations
      .filter((r) => !needle || registrationLabel(r).toLowerCase().includes(needle))
      .slice(0, MAX_REGISTRATION_OPTIONS)
    const selected = registrationsById.get(registrationId)
    if (selected && !matches.some((r) => r.id === selected.id)) matches.unshift(selected)
    return matches
  }, [registrations, registrationsById, registrationFilter, registrationId])

  const payoutOptions = useMemo(
    () => payouts.filter((p) => !p.bankLineId || p.bankLineId === item.id),
    [payouts, item.id]
  )

  useEffect(() => {
    let isCancelled = false
    const loadHistory = async () => {
      try {
        const params = new URLSearchParams({ itemType, itemId: item.id })
        const res = await authFetch(`/api/payments/reconcile/items?${params.toString()}`)
        const data = await res.json().catch(() => ({}))
        if (isCancelled) return
        if (!res.ok) {
          setHistoryError(data.error ?? "Could not load history.")
          return
        }
        setHistory((data.events ?? []) as ReconciliationEventView[])
      } catch {
        if (!isCancelled) setHistoryError("Could not load history.")
      } finally {
        if (!isCancelled) setIsHistoryLoading(false)
      }
    }
    void loadHistory()
    return () => {
      isCancelled = true
    }
  }, [authFetch, itemType, item.id])

  const bankImpact = useMemo(() => {
    if (!isEditable || target.itemType !== "bank" || target.item.kind !== "transfer") return null
    const line = target.item
    const currentRegistration = line.matchedRegistrationId ?? ""
    const keepsApplied = status === "matched" && line.appliedAmount > 0 && registrationId === currentRegistration
    const willReverse = line.appliedAmount > 0 && !keepsApplied
    const willApply = status === "matched" && !!registrationId && !keepsApplied
    if (!willReverse && !willApply) return null
    const parts: string[] = []
    if (willReverse) {
      const previous = registrationsById.get(currentRegistration)
      parts.push(
        `${formatCurrency(line.appliedAmount)} will be reversed from ${previous?.registrationNo ?? "the current registration"} (Amount paid lowered).`
      )
    }
    if (willApply) {
      const next = registrationsById.get(registrationId)
      parts.push(
        `${formatCurrency(line.amount)} will be applied to ${next?.registrationNo ?? "the chosen registration"} and the Payment received email sent.`
      )
    }
    return parts.join(" ")
  }, [isEditable, target, status, registrationId, registrationsById])

  const trimmedComment = comment.trim()
  const canSave =
    isEditable &&
    !isSaving &&
    trimmedComment.length >= MIN_COMMENT_LENGTH &&
    (!needsRegistration || !!registrationId) &&
    (!needsPayout || !!payoutId)

  const handleClose = () => {
    if (isSaving) return
    onClose()
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) handleClose()
  }

  const handleOpenAutoFocus = (event: Event) => {
    const target = dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")
    if (!target) return
    event.preventDefault()
    target.focus()
  }

  const handleBlockWhileSaving = (event: Event) => {
    if (isSaving) event.preventDefault()
  }

  const handleSave = async () => {
    if (!canSave) return
    setIsSaving(true)
    setSaveError("")
    try {
      const res = await authFetch("/api/payments/reconcile/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemType,
          itemId: item.id,
          status,
          registrationId: needsRegistration ? registrationId : null,
          payoutId: needsPayout ? payoutId : null,
          comment: trimmedComment,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSaveError(data.error ?? "Could not save the change.")
        return
      }
      onSaved(
        status === "ignored"
          ? "Row ignored. It will be skipped on future uploads and re-checks."
          : `Status set to ${getStatusLabel(status, itemType)}.`
      )
    } catch {
      setSaveError("Could not save the change.")
    } finally {
      setIsSaving(false)
    }
  }

  const linkedRegistration = item.matchedRegistrationId
    ? registrationsById.get(item.matchedRegistrationId)
    : undefined

  return (
    <DialogFrame onOpenChange={handleOpenChange}>
      <Dialog.Content
        ref={dialogRef}
        aria-describedby={undefined}
        onOpenAutoFocus={handleOpenAutoFocus}
        onEscapeKeyDown={handleBlockWhileSaving}
        onPointerDownOutside={handleBlockWhileSaving}
        onInteractOutside={handleBlockWhileSaving}
        className="my-8 w-full max-w-2xl rounded-xl border border-[color:var(--line-strong)] bg-surface shadow-xl animate-fade focus:outline-none"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--line)] px-6 py-4">
          <div className="flex items-center gap-2">
            <Dialog.Title className="font-display text-2xl font-semibold text-ink">
              {DIALOG_TITLES[mode]}
            </Dialog.Title>
            {isEditable ? (
              <HelpTooltip
                content={mode === "ignore" ? RECONCILIATION_HELP.ignore : RECONCILIATION_HELP.override}
                label={`Help for ${DIALOG_TITLES[mode]}`}
              />
            ) : null}
          </div>
          <Button
            data-autofocus={mode === "history" ? true : undefined}
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={isSaving}
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <ItemSummary target={target} />

          <div className="space-y-1 rounded-md bg-surface-muted/60 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-ink-soft">Current status</span>
              <ReconciliationStatusBadge status={item.status} itemType={itemType} manualOverride={item.manualOverride} />
              {linkedRegistration ? (
                <Link
                  href={`/dashboard/registrations/${linkedRegistration.id}`}
                  className="font-semibold text-accent-ink underline-offset-4 hover:underline"
                >
                  {linkedRegistration.registrationNo} · {linkedRegistration.name}
                </Link>
              ) : null}
            </div>
            {item.statusReason ? <p className="text-ink-soft">{item.statusReason}</p> : null}
            {item.statusComment ? <p className="text-ink">Comment: “{item.statusComment}”</p> : null}
          </div>

          {isEditable ? (
            <div className="space-y-4">
              {mode === "override" ? (
                <div className="space-y-1">
                  <Label htmlFor="recon-status">New status</Label>
                  <select
                    data-autofocus
                    id="recon-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ReconciliationStatus)}
                    className={selectClass}
                    disabled={isSaving}
                  >
                    {RECONCILIATION_STATUSES.map((s) => (
                      <option key={s} value={s}>{getStatusLabel(s, itemType)}</option>
                    ))}
                  </select>
                  <p className="text-xs text-ink-soft">{RECONCILIATION_STATUS_HELP[status]}</p>
                </div>
              ) : null}

              {needsRegistration ? (
                <div className="space-y-1">
                  <Label htmlFor="recon-registration">Participant</Label>
                  <Input
                    placeholder="Filter by registration no, name or Unique Code..."
                    value={registrationFilter}
                    onChange={(e) => setRegistrationFilter(e.target.value)}
                    aria-label="Filter participants"
                    className="h-10 text-sm"
                    disabled={isSaving}
                  />
                  <select
                    id="recon-registration"
                    value={registrationId}
                    onChange={(e) => setRegistrationId(e.target.value)}
                    className={selectClass}
                    disabled={isSaving}
                  >
                    <option value="">Choose a participant…</option>
                    {registrationOptions.map((r) => (
                      <option key={r.id} value={r.id}>{registrationLabel(r)}</option>
                    ))}
                  </select>
                  {registrationId && registrationsById.get(registrationId) ? (
                    <p className="text-xs text-ink-soft">
                      Fee {formatCurrency(registrationsById.get(registrationId)!.amountDue)}
                      {" · "}
                      Paid {formatCurrency(registrationsById.get(registrationId)!.amountPaid)}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {needsPayout ? (
                <div className="space-y-1">
                  <Label htmlFor="recon-payout">Stripe payout</Label>
                  <select
                    id="recon-payout"
                    value={payoutId}
                    onChange={(e) => setPayoutId(e.target.value)}
                    className={selectClass}
                    disabled={isSaving}
                  >
                    <option value="">Choose a payout…</option>
                    {payoutOptions.map((p) => (
                      <option key={p.payoutId} value={p.payoutId}>
                        {formatDateTime(p.createdUtc)} · {formatCurrency(p.amount)} · {p.payoutId}
                      </option>
                    ))}
                  </select>
                  {payoutOptions.length === 0 ? (
                    <p className="text-xs text-ink-soft">
                      No free payouts. Upload the Stripe export that contains this payout first.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {bankImpact ? <Alert variant="warning">{bankImpact}</Alert> : null}
              {isStripePaymentLike && status === "matched" ? (
                <p className="text-xs text-ink-soft">
                  Matching a Stripe row records the link only. Amount paid for Stripe payments is updated by
                  Stripe itself when the participant pays.
                </p>
              ) : null}

              <div className="space-y-1">
                <Label htmlFor="recon-comment">Comment (required)</Label>
                <textarea
                  data-autofocus={mode === "ignore" ? true : undefined}
                  id="recon-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={1000}
                  placeholder={
                    mode === "ignore"
                      ? "Why is this row excluded? e.g. Test payment before go-live"
                      : "Why are you changing this status?"
                  }
                  className={textareaClass}
                  disabled={isSaving}
                  aria-required="true"
                  aria-describedby="recon-comment-hint"
                />
                <p id="recon-comment-hint" className="text-xs text-ink-soft">
                  At least {MIN_COMMENT_LENGTH} characters. Saved with your name in the activity log.
                </p>
              </div>

              {saveError ? <Alert variant="error">{saveError}</Alert> : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">History</h3>
            <HistoryList events={history} isLoading={isHistoryLoading} error={historyError} />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-[color:var(--line)] px-6 py-4">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSaving}>
            {isEditable ? "Cancel" : "Close"}
          </Button>
          {isEditable ? (
            <Button
              type="button"
              variant={status === "ignored" ? "destructive" : "default"}
              onClick={() => void handleSave()}
              isLoading={isSaving}
              loadingText="Saving..."
              disabled={!canSave}
            >
              {mode === "ignore" ? "Ignore row" : "Save status"}
            </Button>
          ) : null}
        </div>
      </Dialog.Content>
    </DialogFrame>
  )
}
