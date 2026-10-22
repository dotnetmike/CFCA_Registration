"use client"

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/context"
import { useBusyCursor } from "@/hooks/use-busy-cursor"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"
import { HelpTooltip } from "@/components/ui/help-tooltip"
import { StatCard } from "@/components/dashboard/stat-card"
import { formatCurrency } from "@/lib/pricing/calculate"
import { invalidateRegistrationCaches } from "@/lib/dashboard/invalidate-registration-caches"
import { classifyStripeType } from "@/lib/reconciliation/matching"
import {
  AWAITING_STRIPE_EXPORT_LABEL,
  BANK_LINE_KIND_LABELS,
  BANK_SETTLEMENT_LABELS,
  ITEM_TYPE_LABELS,
  RECONCILIATION_HELP,
  RUN_SOURCE_LABELS,
  formatReconciliationAction,
} from "@/lib/reconciliation/labels"
import {
  BANK_SETTLEMENTS,
  RECONCILIATION_STATUSES,
  type BankLineView,
  type ReconciliationItemType,
  type ReconciliationOverview,
  type ReconciliationRunView,
} from "@/lib/reconciliation/types"
import { getStatusLabel } from "@/components/reconciliation/reconciliation-status-badge"
import { UploadCard } from "@/components/reconciliation/upload-card"
import {
  ReconciliationItemDialog,
  type DialogMode,
  type DialogTarget,
} from "@/components/reconciliation/reconciliation-item-dialog"
import {
  ActivityTable,
  BankLinesTable,
  PayoutsTable,
  RunsTable,
  StripeTransactionsTable,
} from "@/components/reconciliation/reconciliation-tables"
import { formatCalendarDate, formatDateTime, includesSearch } from "@/components/reconciliation/format"

type TabId = "stripe" | "bank" | "payouts" | "runs" | "activity"
type BusyAction = "refresh" | "recheck" | ReconciliationItemType | null
type Notice = { variant: "success" | "error" | "warning"; message: string }
type FilterOption = { value: string; label: string }
type FilterConfig = { id: string; label: string; options: FilterOption[] }
type FilterValues = Record<string, string>
type OverviewResult = { overview?: ReconciliationOverview; error?: string }

const LOAD_ERROR = "Could not load reconciliation data."

const TAB_ORDER: TabId[] = ["stripe", "bank", "payouts", "runs", "activity"]

const TAB_LABELS: Record<TabId, string> = {
  stripe: "Stripe transactions",
  bank: "Bank statement",
  payouts: "Stripe payouts",
  runs: "Run history",
  activity: "Activity log",
}

const selectClass =
  "flex h-10 w-full rounded-md border border-[color:var(--line-strong)] bg-mist/80 px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"

const statusOptions = (itemType: ReconciliationItemType): FilterOption[] =>
  RECONCILIATION_STATUSES.map((s) => ({ value: s, label: getStatusLabel(s, itemType) }))

const AWAITING_FILTER_VALUE = "awaiting_stripe_export"

const FILTERS: Record<TabId, FilterConfig[]> = {
  stripe: [
    { id: "status", label: "Reconciliation status", options: statusOptions("stripe") },
    {
      id: "type",
      label: "Type",
      options: [
        { value: "payment", label: "Payments" },
        { value: "refund", label: "Refunds" },
        { value: "payout", label: "Payouts" },
        { value: "other", label: "Fees & other" },
      ],
    },
    {
      id: "settlement",
      label: "Bank settlement",
      options: BANK_SETTLEMENTS.map((value) => ({ value, label: BANK_SETTLEMENT_LABELS[value] })),
    },
  ],
  bank: [
    {
      id: "status",
      label: "Reconciliation status",
      options: [...statusOptions("bank"), { value: AWAITING_FILTER_VALUE, label: AWAITING_STRIPE_EXPORT_LABEL }],
    },
    {
      id: "kind",
      label: "Kind",
      options: Object.entries(BANK_LINE_KIND_LABELS).map(([value, label]) => ({ value, label })),
    },
  ],
  payouts: [
    {
      id: "bank",
      label: "Bank",
      options: [
        { value: "received", label: "Received in bank" },
        { value: "missing", label: "Not in bank statement yet" },
      ],
    },
    {
      id: "difference",
      label: "Rows",
      options: [
        { value: "balanced", label: "All rows uploaded ($0.00 difference)" },
        { value: "unbalanced", label: "Rows missing (difference ≠ $0.00)" },
      ],
    },
  ],
  runs: [
    {
      id: "source",
      label: "Run",
      options: Object.entries(RUN_SOURCE_LABELS).map(([value, label]) => ({ value, label })),
    },
    {
      id: "result",
      label: "Result",
      options: [
        { value: "completed", label: "Completed" },
        { value: "failed", label: "Failed" },
      ],
    },
  ],
  activity: [
    {
      id: "item",
      label: "Item",
      options: [
        ...Object.entries(ITEM_TYPE_LABELS).map(([value, label]) => ({ value, label })),
        { value: "run", label: "Runs" },
      ],
    },
    {
      id: "action",
      label: "Action",
      options: [
        "imported",
        "rechecked",
        "ignored",
        "status_override",
        "payment_applied",
        "payment_reversed",
        "payment_apply_failed",
        "bank_confirmed",
        "bank_unconfirmed",
        "run_completed",
        "run_failed",
      ].map((value) => ({ value, label: formatReconciliationAction(value) })),
    },
  ],
}

const SEARCH_PLACEHOLDERS: Record<TabId, string> = {
  stripe: "Search by transaction id, Unique Code, registration no, name, reason...",
  bank: "Search by description, amount, registration no, name, reason...",
  payouts: "Search by payout id or amount...",
  runs: "Search by file name, run type or user...",
  activity: "Search by item, comment, registration no or user...",
}

const describeRun = (run: ReconciliationRunView) => {
  const parts: string[] = []
  if (run.source !== "recheck") {
    parts.push(
      `${run.rowsInFile} rows in file: ${run.newRows} new, ${run.skippedRows} already reconciled and skipped.`
    )
  }
  if (run.recheckedRows > 0 || run.source === "recheck") {
    parts.push(`${run.recheckedRows} previously unmatched rows re-checked.`)
  }
  parts.push(
    `Result: ${run.matched} matched, ${run.unmatched} unmatched, ${run.notApplicable} not applicable.`
  )
  if (run.paymentsApplied > 0) {
    parts.push(
      `${run.paymentsApplied} bank payment${run.paymentsApplied === 1 ? "" : "s"} applied (${formatCurrency(run.amountApplied)}) and Payment received emails sent.`
    )
  }
  if (run.bankConfirmed > 0) {
    parts.push(
      `${run.bankConfirmed} Stripe row${run.bankConfirmed === 1 ? "" : "s"} confirmed as received in the bank.`
    )
  }
  return `${RUN_SOURCE_LABELS[run.source]} completed. ${parts.join(" ")}`
}

const matchesBankStatusFilter = (row: BankLineView, status: string) => {
  if (!status) return true
  if (status === AWAITING_FILTER_VALUE) return row.awaitingStripeExport
  return row.status === status && !row.awaitingStripeExport
}

const ReconcilePage = () => {
  const { user, authFetch } = useAuth()
  const router = useRouter()
  const [overview, setOverview] = useState<ReconciliationOverview | null>(null)
  const [loadedAt, setLoadedAt] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [busyAction, setBusyAction] = useState<BusyAction>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [tab, setTab] = useState<TabId>("stripe")
  const [search, setSearch] = useState("")
  const [filters, setFilters] = useState<FilterValues>({})
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<{ mode: DialogMode; target: DialogTarget } | null>(null)
  useBusyCursor(busyAction !== null)

  const canReconcile = !!user?.permissions.includes("payments:reconcile")
  const isBusy = busyAction !== null

  const fetchOverview = useCallback(async (): Promise<OverviewResult> => {
    try {
      const res = await authFetch("/api/payments/reconcile")
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return { error: data.error ?? LOAD_ERROR }
      return { overview: data as ReconciliationOverview }
    } catch {
      return { error: LOAD_ERROR }
    }
  }, [authFetch])

  const applyOverviewResult = useCallback((result: OverviewResult) => {
    if (result.overview) {
      setOverview(result.overview)
      setLoadedAt(new Date().toISOString())
    }
    setLoadError(result.error ?? "")
    setIsLoading(false)
  }, [])

  const loadOverview = useCallback(async () => {
    applyOverviewResult(await fetchOverview())
  }, [fetchOverview, applyOverviewResult])

  useEffect(() => {
    if (!user) return
    if (!canReconcile) {
      router.push("/dashboard")
      return
    }
    let isCancelled = false
    void fetchOverview().then((result) => {
      if (!isCancelled) applyOverviewResult(result)
    })
    return () => {
      isCancelled = true
    }
  }, [user, canReconcile, router, fetchOverview, applyOverviewResult])

  const showView = (next: TabId, preset: FilterValues = {}) => {
    setTab(next)
    setFilters(preset)
    setPage(1)
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleFilterChange = (filterId: string) => (value: string) => {
    setFilters((current) => ({ ...current, [filterId]: value }))
    setPage(1)
  }

  const registrationsById = useMemo(
    () => new Map((overview?.registrations ?? []).map((r) => [r.id, r])),
    [overview]
  )

  const registrationSearchValues = useCallback(
    (registrationId: string | null) => {
      const registration = registrationId ? registrationsById.get(registrationId) : undefined
      return registration
        ? [registration.registrationNo, registration.name, registration.participantReference]
        : []
    },
    [registrationsById]
  )

  const kpis = useMemo(() => {
    const stripe = overview?.stripe ?? []
    const bank = overview?.bank ?? []
    const count = <T extends { status: string }>(rows: T[], status: string) =>
      rows.filter((r) => r.status === status).length
    const appliedLines = bank.filter((b) => b.appliedAmount > 0)
    const awaitingLines = bank.filter((b) => b.awaitingStripeExport)
    const payments = stripe.filter((r) => classifyStripeType(r.type) === "payment")
    const receivedPayments = payments.filter((r) => r.bankSettlement === "received")
    return {
      stripeMatched: count(stripe, "matched"),
      stripeUnmatched: count(stripe, "unmatched"),
      stripeIgnored: count(stripe, "ignored"),
      bankMatched: count(bank, "matched"),
      bankUnmatched: count(bank, "unmatched") - awaitingLines.length,
      bankAwaiting: awaitingLines.length,
      appliedCount: appliedLines.length,
      appliedTotal: appliedLines.reduce((sum, b) => sum + b.appliedAmount, 0),
      receivedCount: receivedPayments.length,
      receivedTotal: receivedPayments.reduce((sum, r) => sum + r.amount, 0),
      awaitingBankCount: payments.filter((r) => r.bankSettlement === "awaiting_bank").length,
    }
  }, [overview])

  const filteredStripe = useMemo(
    () =>
      (overview?.stripe ?? []).filter(
        (row) =>
          (!filters.status || row.status === filters.status) &&
          (!filters.type || classifyStripeType(row.type) === filters.type) &&
          (!filters.settlement || row.bankSettlement === filters.settlement) &&
          includesSearch(search, [
            row.stripeTxnId,
            row.sourceId,
            row.type,
            row.metadataParticipantReference,
            row.metadataRegistrationId,
            row.payoutId,
            row.statusReason,
            row.statusComment,
            row.amount.toFixed(2),
            ...registrationSearchValues(row.matchedRegistrationId),
          ])
      ),
    [overview, filters, search, registrationSearchValues]
  )

  const filteredBank = useMemo(
    () =>
      (overview?.bank ?? []).filter(
        (row) =>
          matchesBankStatusFilter(row, filters.status ?? "") &&
          (!filters.kind || row.kind === filters.kind) &&
          includesSearch(search, [
            row.description,
            row.transactionDate,
            formatCalendarDate(row.transactionDate),
            row.amount.toFixed(2),
            row.matchedStripePayoutId,
            row.statusReason,
            row.statusComment,
            ...registrationSearchValues(row.matchedRegistrationId),
          ])
      ),
    [overview, filters, search, registrationSearchValues]
  )

  const filteredPayouts = useMemo(
    () =>
      (overview?.payouts ?? []).filter((row) => {
        const isBalanced = Math.abs(row.difference) < 0.005
        return (
          (!filters.bank || (filters.bank === "received" ? !!row.bankDate : !row.bankDate)) &&
          (!filters.difference || (filters.difference === "balanced" ? isBalanced : !isBalanced)) &&
          includesSearch(search, [row.payoutId, row.stripeTxnId, row.amount.toFixed(2)])
        )
      }),
    [overview, filters, search]
  )

  const filteredRuns = useMemo(
    () =>
      (overview?.runs ?? []).filter(
        (run) =>
          (!filters.source || run.source === filters.source) &&
          (!filters.result || run.status === filters.result) &&
          includesSearch(search, [run.filename, RUN_SOURCE_LABELS[run.source], run.createdByName, run.error])
      ),
    [overview, filters, search]
  )

  const filteredEvents = useMemo(
    () =>
      (overview?.events ?? []).filter(
        (event) =>
          (!filters.item || (event.itemType ?? "run") === filters.item) &&
          (!filters.action || event.action === filters.action) &&
          includesSearch(search, [
            event.itemLabel,
            event.comment,
            event.actorName,
            formatReconciliationAction(event.action),
            ...registrationSearchValues(event.registrationId),
          ])
      ),
    [overview, filters, search, registrationSearchValues]
  )

  const tabCounts: Record<TabId, number> = {
    stripe: overview?.stripe.length ?? 0,
    bank: overview?.bank.length ?? 0,
    payouts: overview?.payouts.length ?? 0,
    runs: overview?.runs.length ?? 0,
    activity: overview?.events.length ?? 0,
  }

  const lastRunBySource = useMemo(() => {
    const runs = overview?.runs ?? []
    return {
      stripe: runs.find((r) => r.source === "stripe") ?? null,
      bank: runs.find((r) => r.source === "bank") ?? null,
    }
  }, [overview])

  const handleTabChange = (next: TabId) => {
    showView(next)
  }

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return
    event.preventDefault()
    const direction = event.key === "ArrowRight" ? 1 : -1
    const nextIndex = (TAB_ORDER.indexOf(tab) + direction + TAB_ORDER.length) % TAB_ORDER.length
    const next = TAB_ORDER[nextIndex]
    handleTabChange(next)
    document.getElementById(`recon-tab-${next}`)?.focus()
  }

  const handleShowNeedsReview = () => {
    const next: TabId = kpis.stripeUnmatched === 0 && kpis.bankUnmatched > 0 ? "bank" : "stripe"
    showView(next, { status: "unmatched" })
  }

  const handleShowAwaitingBank = () => {
    showView("stripe", { type: "payment", settlement: "awaiting_bank" })
  }

  const handleRefresh = async () => {
    if (isBusy) return
    setBusyAction("refresh")
    await loadOverview()
    setBusyAction(null)
  }

  const handleRecheck = async () => {
    if (isBusy) return
    setBusyAction("recheck")
    setNotice(null)
    try {
      const res = await authFetch("/api/payments/reconcile/recheck", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setNotice({ variant: "error", message: data.error ?? "Re-check failed." })
        return
      }
      invalidateRegistrationCaches()
      setNotice({ variant: "success", message: describeRun(data.run as ReconciliationRunView) })
    } catch {
      setNotice({ variant: "error", message: "Re-check failed." })
    } finally {
      await loadOverview()
      setBusyAction(null)
    }
  }

  const handleUpload = (source: ReconciliationItemType) => async (file: File) => {
    if (isBusy) return false
    setBusyAction(source)
    setNotice(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("source", source)
      const res = await authFetch("/api/payments/reconcile", { method: "POST", body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setNotice({ variant: "error", message: data.error ?? "Upload failed." })
        return false
      }
      const run = data.run as ReconciliationRunView
      invalidateRegistrationCaches()
      setNotice({ variant: run.unmatched > 0 ? "warning" : "success", message: describeRun(run) })
      showView(source)
      return true
    } catch {
      setNotice({ variant: "error", message: "Upload failed." })
      return false
    } finally {
      await loadOverview()
      setBusyAction(null)
    }
  }

  const handleAction = (mode: DialogMode, target: DialogTarget) => {
    setDialog({ mode, target })
  }

  const handleDialogClose = () => {
    setDialog(null)
  }

  const handleDialogSaved = async (message: string) => {
    invalidateRegistrationCaches()
    setDialog(null)
    setNotice({ variant: "success", message })
    await loadOverview()
  }

  if (isLoading) return <p className="text-center text-ink-soft">Loading payment reconciliation...</p>

  const needsReview = kpis.stripeUnmatched + kpis.bankUnmatched

  return (
    <div className="cfca-page space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-ink">
            Staff workspace
          </p>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-4xl font-semibold text-ink">Payment Reconciliation</h1>
            <HelpTooltip content={RECONCILIATION_HELP.page} label="About payment reconciliation" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleRecheck()}
              isLoading={busyAction === "recheck"}
              loadingText="Re-checking..."
              disabled={isBusy || needsReview === 0}
              aria-label="Re-check unmatched rows"
            >
              Re-check unmatched
            </Button>
            <HelpTooltip content={RECONCILIATION_HELP.recheck} label="Help for Re-check unmatched" />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleRefresh()}
            isLoading={busyAction === "refresh"}
            loadingText="Refreshing..."
            disabled={isBusy}
            aria-label="Refresh reconciliation data"
          >
            Refresh
          </Button>
        </div>
      </div>

      {loadedAt ? (
        <p className="text-sm text-gray-500">
          Updated {formatDateTime(loadedAt)}
          {" · "}
          {tabCounts.stripe} Stripe rows · {tabCounts.bank} bank lines · {overview?.registrations.length ?? 0} registrations
        </p>
      ) : null}
      {loadError ? <p className="text-sm text-red-600" role="alert">{loadError}</p> : null}
      {notice ? (
        <Alert variant={notice.variant}>
          <div className="flex items-start justify-between gap-3">
            <p>{notice.message}</p>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="shrink-0 text-xs font-semibold underline underline-offset-2"
              aria-label="Dismiss message"
            >
              Dismiss
            </button>
          </div>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Matched Stripe"
          value={String(kpis.stripeMatched)}
          hint={`${kpis.stripeUnmatched} unmatched · ${kpis.stripeIgnored} ignored`}
          tone="brand"
        />
        <div className="relative animate-rise-delay-1">
          <StatCard
            label="Stripe payments in bank"
            value={formatCurrency(kpis.receivedTotal)}
            hint={`${kpis.receivedCount} confirmed received · ${kpis.awaitingBankCount} paid out, awaiting CBA statement`}
            tone="success"
            className="h-full"
          />
          {kpis.awaitingBankCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute bottom-3 right-3 h-7 px-2 text-xs"
              onClick={handleShowAwaitingBank}
              aria-label="Show Stripe payments awaiting the CBA statement"
            >
              Show
            </Button>
          ) : null}
        </div>
        <StatCard
          label="Applied from bank"
          value={formatCurrency(kpis.appliedTotal)}
          hint={`${kpis.appliedCount} transfer${kpis.appliedCount === 1 ? "" : "s"} applied · ${kpis.bankMatched} bank lines matched`}
          tone="info"
          className="animate-rise-delay-2"
        />
        <div className="relative animate-rise-delay-3">
          <StatCard
            label="Needs review"
            value={String(needsReview)}
            hint={
              kpis.bankAwaiting > 0
                ? `Unmatched rows · ${kpis.bankAwaiting} STRIPE credit${kpis.bankAwaiting === 1 ? "" : "s"} awaiting Stripe export`
                : "Unmatched Stripe and bank rows"
            }
            tone="warning"
            className="h-full"
          />
          {needsReview > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute bottom-3 right-3 h-7 px-2 text-xs"
              onClick={handleShowNeedsReview}
              aria-label="Show unmatched rows"
            >
              Show
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <UploadCard
          id="upload-stripe"
          title="Stripe transaction history"
          description="Balance history CSV. Rows are matched to participants; payouts are grouped for the bank."
          help={RECONCILIATION_HELP.stripeUpload}
          lastRun={lastRunBySource.stripe}
          isUploading={busyAction === "stripe"}
          disabled={isBusy}
          onUpload={handleUpload("stripe")}
        />
        <UploadCard
          id="upload-bank"
          title="CBA bank statement"
          description="NetBank CSV. Transfers are applied to registrations; STRIPE Direct Credits are matched to payouts."
          help={RECONCILIATION_HELP.bankUpload}
          lastRun={lastRunBySource.bank}
          isUploading={busyAction === "bank"}
          disabled={isBusy}
          onUpload={handleUpload("bank")}
        />
      </div>

      <div
        role="tablist"
        aria-label="Reconciliation views"
        className="flex items-center gap-1 overflow-x-auto whitespace-nowrap rounded-xl border border-[color:var(--line)] bg-surface/80 p-1.5"
      >
        {TAB_ORDER.map((id) => {
          const isActive = tab === id
          return (
            <button
              key={id}
              id={`recon-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls="recon-tabpanel"
              tabIndex={isActive ? 0 : -1}
              onClick={() => handleTabChange(id)}
              onKeyDown={handleTabKeyDown}
              className={
                isActive
                  ? "rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors"
                  : "rounded-lg px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-muted/80 hover:text-ink"
              }
            >
              {TAB_LABELS[id]}
              <span className={isActive ? "ml-1.5 text-white/80" : "ml-1.5 text-ink-soft/70"}>
                {tabCounts[id]}
              </span>
            </button>
          )
        })}
        {tab === "payouts" ? (
          <HelpTooltip content={RECONCILIATION_HELP.payouts} label="How Stripe payouts are matched" className="ml-2" />
        ) : null}
      </div>

      <div id="recon-tabpanel" role="tabpanel" aria-labelledby={`recon-tab-${tab}`} className="space-y-4">
        <Input
          placeholder={SEARCH_PLACEHOLDERS[tab]}
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          aria-label={`Search ${TAB_LABELS[tab]}`}
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FILTERS[tab].map((config) => (
            <div key={`${tab}-${config.id}`} className="space-y-1">
              <Label htmlFor={`recon-filter-${config.id}`}>{config.label}</Label>
              <select
                id={`recon-filter-${config.id}`}
                value={filters[config.id] ?? ""}
                onChange={(e) => handleFilterChange(config.id)(e.target.value)}
                className={selectClass}
                aria-label={`Filter by ${config.label.toLowerCase()}`}
              >
                <option value="">All</option>
                {config.options.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {tab === "stripe" ? (
          <StripeTransactionsTable
            rows={filteredStripe}
            totalLoaded={tabCounts.stripe}
            page={page}
            onPageChange={setPage}
            registrationsById={registrationsById}
            onAction={handleAction}
          />
        ) : null}
        {tab === "bank" ? (
          <BankLinesTable
            rows={filteredBank}
            totalLoaded={tabCounts.bank}
            page={page}
            onPageChange={setPage}
            registrationsById={registrationsById}
            onAction={handleAction}
          />
        ) : null}
        {tab === "payouts" ? (
          <PayoutsTable rows={filteredPayouts} totalLoaded={tabCounts.payouts} page={page} onPageChange={setPage} />
        ) : null}
        {tab === "runs" ? (
          <RunsTable rows={filteredRuns} totalLoaded={tabCounts.runs} page={page} onPageChange={setPage} />
        ) : null}
        {tab === "activity" ? (
          <ActivityTable
            rows={filteredEvents}
            totalLoaded={tabCounts.activity}
            page={page}
            onPageChange={setPage}
            registrationsById={registrationsById}
          />
        ) : null}
      </div>

      {dialog && overview ? (
        <ReconciliationItemDialog
          key={`${dialog.mode}-${dialog.target.item.id}`}
          mode={dialog.mode}
          target={dialog.target}
          registrations={overview.registrations}
          payouts={overview.payouts}
          onClose={handleDialogClose}
          onSaved={(message) => void handleDialogSaved(message)}
        />
      ) : null}
    </div>
  )
}

export default ReconcilePage
