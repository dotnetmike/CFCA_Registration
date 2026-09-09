"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useAuth } from "@/lib/auth/context"
import { isManager } from "@/lib/auth/permissions-client"
import { useBusyCursor } from "@/hooks/use-busy-cursor"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/dashboard/stat-card"
import { WelcomePanel } from "@/components/dashboard/welcome-panel"
import { DashboardPanel } from "@/components/dashboard/dashboard-panel"
import { formatCurrency } from "@/lib/pricing/calculate"
import { formatCacheAge } from "@/lib/dashboard/list-cache"
import {
  emptyPaymentStatusCounts,
  emptyReportsTotals,
  reportsCache,
  type ReportsPaymentStatusCounts,
  type ReportsSummary,
  type ReportsTotals,
} from "@/lib/dashboard/reports-cache"

const PAYMENT_COLORS: Record<keyof ReportsPaymentStatusCounts, string> = {
  pending: "#d97706",
  partial: "#0284c7",
  paid: "#059669",
  overpaid: "#7c3aed",
}

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
        if (cached?.isFresh) {
          setSummary(cached.value.summary)
          setTotals(cached.value.totals)
          setPaymentStatusCounts(cached.value.paymentStatusCounts)
          setFetchedAt(cached.fetchedAt)
          setIsLoading(false)
          return
        }
        if (cached) {
          setSummary(cached.value.summary)
          setTotals(cached.value.totals)
          setPaymentStatusCounts(cached.value.paymentStatusCounts)
          setFetchedAt(cached.fetchedAt)
          setIsLoading(false)
        }
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
        const entry = reportsCache.set({
          summary: nextSummary,
          total: nextTotals.registrations,
          totals: nextTotals,
          paymentStatusCounts: nextPayment,
        })
        setSummary(nextSummary)
        setTotals(nextTotals)
        setPaymentStatusCounts(nextPayment)
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

  const stateRows = useMemo(() => {
    return Object.entries(summary)
      .map(([state, data]) => ({ state, ...data }))
      .sort((a, b) => b.registrations - a.registrations)
  }, [summary])

  const stateChartData = useMemo(
    () =>
      stateRows.map((row) => ({
        state: row.state,
        registrations: row.registrations,
        attendees: row.attendees + row.spouses + row.kids,
      })),
    [stateRows]
  )

  const compositionData = useMemo(
    () => [
      { name: "Primary", value: totals.attendees, fill: "#0d47a1" },
      { name: "Spouses", value: totals.spouses, fill: "#1565c0" },
      { name: "Kids", value: totals.kids, fill: "#42a5f5" },
    ],
    [totals]
  )

  const paymentChartData = useMemo(
    () =>
      (Object.keys(paymentStatusCounts) as (keyof ReportsPaymentStatusCounts)[]).map(
        (status) => ({
          name: status,
          value: paymentStatusCounts[status],
          fill: PAYMENT_COLORS[status],
        })
      ),
    [paymentStatusCounts]
  )

  const maxStateRegistrations = Math.max(1, ...stateRows.map((r) => r.registrations))

  if (isLoading) {
    return <p className="text-center text-ink-soft">Loading reports...</p>
  }

  return (
    <div className="cfca-page space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-ink">
            Staff workspace
          </p>
          <h1 className="font-display text-4xl font-semibold text-ink">Reports</h1>
          {fetchedAt != null && (
            <p className="text-sm text-ink-soft">
              Summary cached · updated {formatCacheAge(fetchedAt)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleExport()}
            isLoading={isExporting}
            loadingText="Exporting..."
            disabled={isExporting || isRefreshing}
            aria-label="Export detailed CSV"
          >
            Export CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadReports(true)}
            isLoading={isRefreshing}
            loadingText="Refreshing..."
            disabled={isRefreshing || isExporting}
            aria-label="Refresh reports summary"
          >
            Refresh
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
          hint={`${totals.attendees + totals.spouses + totals.kids} people in total`}
          tone="brand"
          icon={<IconUsers />}
        />
        <StatCard
          label="Attendees"
          value={String(totals.attendees + totals.spouses + totals.kids)}
          hint={`${totals.spouses} spouses · ${totals.kids} kids`}
          tone="info"
          icon={<IconPeople />}
          className="animate-rise-delay-1"
        />
        <StatCard
          label="Collected"
          value={formatCurrency(totals.amount_paid)}
          hint={`of ${formatCurrency(totals.amount_due)} due`}
          tone="success"
          icon={<IconPaid />}
          className="animate-rise-delay-2"
        />
        <StatCard
          label="Remaining"
          value={formatCurrency(totals.amount_remaining)}
          hint={`${paymentStatusCounts.pending + paymentStatusCounts.partial} unpaid / partial`}
          tone="warning"
          icon={<IconBalance />}
          className="animate-rise-delay-3"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <WelcomePanel
          name={user?.name?.trim() || "team"}
          secondaryAction={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
              onClick={() => void handleExport()}
              isLoading={isExporting}
              loadingText="Exporting..."
              disabled={isExporting || isRefreshing}
              aria-label="Export detailed registrations CSV"
            >
              Export detailed CSV
            </Button>
          }
        />
        <DashboardPanel
          title="Payment status"
          description="Distribution across all registrations"
        >
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentChartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={3}
                >
                  {paymentChartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [String(value ?? 0), "Registrations"]}
                  contentStyle={{
                    borderRadius: 12,
                    borderColor: "rgba(13,71,161,0.16)",
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {paymentChartData.map((entry) => (
              <li key={entry.name} className="flex items-center gap-2 capitalize text-ink-soft">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: entry.fill }}
                  aria-hidden="true"
                />
                {entry.name}
                <span className="ml-auto font-semibold tabular-nums text-ink">{entry.value}</span>
              </li>
            ))}
          </ul>
        </DashboardPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DashboardPanel
          title="Registrations by state"
          description="Submitted registrations grouped by CFCA membership state"
        >
          <div className="h-72">
            {stateChartData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-ink-soft">
                No registration data yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stateChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(13,71,161,0.12)" />
                  <XAxis dataKey="state" tick={{ fontSize: 12, fill: "#1a3348" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#1a3348" }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      borderColor: "rgba(13,71,161,0.16)",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="registrations" fill="#0d47a1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </DashboardPanel>

        <DashboardPanel
          title="People composition"
          description="Primary registrants, spouses, and children under 18"
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compositionData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(13,71,161,0.12)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#1a3348" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#1a3348" }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    borderColor: "rgba(13,71,161,0.16)",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {compositionData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardPanel>
      </div>

      <DashboardPanel
        title={`Summary by state (${totals.registrations} registrations)`}
        description="Share of total registrations shown as progress bars"
        bodyClassName="overflow-x-auto p-0 sm:p-0"
      >
        <table className="cfca-reports-table">
          <thead>
            <tr>
              <th className="px-5 sm:px-6">State</th>
              <th>Registrations</th>
              <th>Attendees</th>
              <th>Spouses</th>
              <th>Kids</th>
              <th className="min-w-[10rem] px-5 sm:px-6">Share</th>
            </tr>
          </thead>
          <tbody>
            {stateRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-ink-soft">
                  No registration data yet.
                </td>
              </tr>
            ) : (
              stateRows.map((row) => {
                const share = Math.round((row.registrations / maxStateRegistrations) * 100)
                return (
                  <tr key={row.state}>
                    <td className="px-5 font-semibold sm:px-6">{row.state}</td>
                    <td className="tabular-nums">{row.registrations}</td>
                    <td className="tabular-nums">{row.attendees}</td>
                    <td className="tabular-nums">{row.spouses}</td>
                    <td className="tabular-nums">{row.kids}</td>
                    <td className="px-5 sm:px-6">
                      <div className="flex items-center gap-3">
                        <div className="cfca-progress-track flex-1" aria-hidden="true">
                          <div
                            className="cfca-progress-fill"
                            style={{ width: `${share}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-xs tabular-nums text-ink-soft">
                          {totals.registrations > 0
                            ? Math.round((row.registrations / totals.registrations) * 100)
                            : 0}
                          %
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </DashboardPanel>

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
