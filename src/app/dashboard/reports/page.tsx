"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/context"
import { isManager } from "@/lib/auth/permissions-client"
import { useBusyCursor } from "@/hooks/use-busy-cursor"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/dashboard/stat-card"
import { DashboardPanel } from "@/components/dashboard/dashboard-panel"
import { EarlyBirdCapacityPanel } from "@/components/dashboard/early-bird-capacity-panel"
import { StateHeadcountMap } from "@/components/dashboard/state-headcount-map"
import {
  AttendeeCompositionPanel,
  CollectionProgressPanel,
  PaymentStatusPanel,
  StateRegistrationsPanel,
} from "@/components/dashboard/reports-overview"
import { formatCurrency } from "@/lib/pricing/calculate"
import { PAYMENT_LABELS } from "@/lib/payments/labels"
import { formatCacheAge } from "@/lib/dashboard/list-cache"
import { adultTotal, collectionProgress } from "@/lib/dashboard/reports-overview"
import {
  emptyPaymentStatusCounts,
  emptyReportsTotals,
  reportsCache,
  type EarlyBirdUsage,
  type ReportsPaymentStatusCounts,
  type ReportsSummary,
  type ReportsTotals,
} from "@/lib/dashboard/reports-cache"

const IconDownload = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M5 21h14" />
  </svg>
)

const IconList = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="M4 6h.01M4 12h.01M4 18h.01" />
  </svg>
)

const IconUsers = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const IconPeople = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20a8 8 0 0 1 16 0" />
  </svg>
)

const IconPaid = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
  </svg>
)

const IconBalance = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 3v18" />
    <path d="M5 7h14" />
    <path d="M7 7l-3 7a4 4 0 0 0 8 0L9 7" />
    <path d="M17 7l-3 7a4 4 0 0 0 8 0l-3-7" />
  </svg>
)

const ReportsPage = () => {
  const { user, authFetch } = useAuth()
  const router = useRouter()
  const [summary, setSummary] = useState<ReportsSummary>({})
  const [totals, setTotals] = useState<ReportsTotals>(emptyReportsTotals())
  const [paymentStatusCounts, setPaymentStatusCounts] =
    useState<ReportsPaymentStatusCounts>(emptyPaymentStatusCounts())
  const [earlyBird, setEarlyBird] = useState<EarlyBirdUsage | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [exportError, setExportError] = useState("")
  useBusyCursor(isExporting || isRefreshing)

  const loadReports = useCallback(
    async (forceRefresh: boolean) => {
      if (!forceRefresh) {
        const cached = reportsCache.get()
        if (cached) {
          setSummary(cached.value.summary)
          setTotals(cached.value.totals)
          setPaymentStatusCounts(cached.value.paymentStatusCounts)
          setEarlyBird(cached.value.earlyBird)
          setFetchedAt(cached.fetchedAt)
          setIsLoading(false)
        }
        if (cached?.isFresh) return
      } else {
        reportsCache.clear()
      }

      if (forceRefresh) setIsRefreshing(true)
      else if (!reportsCache.get()) setIsLoading(true)

      setLoadError("")
      try {
        const res = await authFetch("/api/admin/reports")
        if (!res.ok) {
          setLoadError("Could not load reports.")
          return
        }
        const data = await res.json()
        const nextSummary = (data.summary ?? {}) as ReportsSummary
        const nextTotals = (data.totals ?? emptyReportsTotals()) as ReportsTotals
        const nextPayment = (data.paymentStatusCounts ??
          emptyPaymentStatusCounts()) as ReportsPaymentStatusCounts
        const nextEarlyBird = (data.earlyBird ?? null) as EarlyBirdUsage | null
        const entry = reportsCache.set({
          summary: nextSummary,
          total: nextTotals.registrations,
          totals: nextTotals,
          paymentStatusCounts: nextPayment,
          earlyBird: nextEarlyBird,
        })
        setSummary(nextSummary)
        setTotals(nextTotals)
        setPaymentStatusCounts(nextPayment)
        setEarlyBird(nextEarlyBird)
        setFetchedAt(entry.fetchedAt)
      } catch {
        setLoadError("Could not load reports.")
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [authFetch]
  )

  useEffect(() => {
    if (!user) return
    if (!isManager(user)) {
      router.push("/")
      return
    }
    void loadReports(false)
  }, [user, router, loadReports])

  const handleExport = async () => {
    setIsExporting(true)
    setExportError("")
    try {
      const res = await authFetch("/api/admin/reports?format=csv")
      if (!res.ok) {
        setExportError("Could not export CSV. Please try again.")
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "registrations.csv"
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setExportError("Could not export CSV. Please try again.")
    } finally {
      setIsExporting(false)
    }
  }

  if (isLoading) {
    return <p className="text-center text-ink-soft">Loading reports...</p>
  }

  const progress = collectionProgress(totals)

  return (
    <div className="cfca-page space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-ink">
            CFCA National Conference 2027
          </p>
          <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
            Registration &amp; Payment Report
          </h1>
          <p className="text-sm text-ink-soft">
            Conference operations overview
            {fetchedAt != null ? ` · Summary cached · updated ${formatCacheAge(fetchedAt)}` : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleExport()}
            isLoading={isExporting}
            loadingText="Exporting..."
            disabled={isExporting || isRefreshing}
            aria-label="Export detailed CSV"
          >
            <IconDownload />
            Export CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadReports(true)}
            isLoading={isRefreshing}
            loadingText="Refreshing..."
            disabled={isRefreshing || isExporting}
            aria-label="Refresh reports summary"
          >
            Refresh
          </Button>
          <Button asChild>
            <Link href="/dashboard" aria-label="View registrations">
              <IconList />
              View registrations
            </Link>
          </Button>
        </div>
      </div>

      {loadError && (
        <p className="text-sm text-[color:var(--danger)]" role="alert">
          {loadError}
        </p>
      )}
      {exportError && (
        <p className="text-sm text-[color:var(--danger)]" role="alert">
          {exportError}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Registrations"
          value={String(totals.registrations)}
          hint="Submitted registrations"
          tone="brand"
          icon={<IconUsers />}
        />
        <StatCard
          label="Total attendees"
          value={String(totals.people)}
          hint={`${adultTotal(totals)} adults · ${totals.kids} under 18`}
          tone="info"
          icon={<IconPeople />}
          className="animate-rise-delay-1"
        />
        <StatCard
          label="Payments collected"
          value={formatCurrency(totals.amount_paid)}
          hint={`${progress.collectedPercent.toFixed(1)}% of total fees`}
          tone="success"
          icon={<IconPaid />}
          className="animate-rise-delay-2"
        />
        <StatCard
          label={PAYMENT_LABELS.balanceDue}
          value={formatCurrency(totals.amount_remaining)}
          hint={`${progress.balancePercent.toFixed(1)}% of total fees`}
          tone="warning"
          icon={<IconBalance />}
          className="animate-rise-delay-3"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <CollectionProgressPanel totals={totals} paymentStatusCounts={paymentStatusCounts} />
        <PaymentStatusPanel paymentStatusCounts={paymentStatusCounts} registrations={totals.registrations} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StateRegistrationsPanel summary={summary} registrations={totals.registrations} />
        <AttendeeCompositionPanel totals={totals} />
      </div>

      {fetchedAt != null ? <StateHeadcountMap summary={summary} asOf={fetchedAt} /> : null}

      {earlyBird ? <EarlyBirdCapacityPanel earlyBird={earlyBird} /> : null}

      <DashboardPanel
        title="Detailed export"
        description="CSV is always generated fresh from the database and includes all non-secret registration fields, with attendees and souvenir orders as readable text."
      >
        <Button
          onClick={() => void handleExport()}
          isLoading={isExporting}
          loadingText="Exporting..."
          disabled={isExporting || isRefreshing}
          aria-label="Export detailed CSV"
        >
          Export Detailed CSV
        </Button>
      </DashboardPanel>
    </div>
  )
}

export default ReportsPage
