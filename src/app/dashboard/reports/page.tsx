"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/context"
import { isManager } from "@/lib/auth/permissions-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useBusyCursor } from "@/hooks/use-busy-cursor"
import { Button } from "@/components/ui/button"
import { DashboardSubnav } from "@/components/layout/dashboard-subnav"
import { formatCacheAge } from "@/lib/dashboard/list-cache"
import { reportsCache, type ReportsSummary } from "@/lib/dashboard/reports-cache"

const ReportsPage = () => {
  const { user, authFetch } = useAuth()
  const router = useRouter()
  const [summary, setSummary] = useState<ReportsSummary>({})
  const [total, setTotal] = useState(0)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [loadError, setLoadError] = useState("")
  useBusyCursor(isExporting || isRefreshing)

  const loadReports = useCallback(
    async (forceRefresh: boolean) => {
      if (!forceRefresh) {
        const cached = reportsCache.get()
        if (cached?.isFresh) {
          setSummary(cached.value.summary)
          setTotal(cached.value.total)
          setFetchedAt(cached.fetchedAt)
          setIsLoading(false)
          return
        }
        if (cached) {
          setSummary(cached.value.summary)
          setTotal(cached.value.total)
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
        const nextTotal = (data.registrations ?? []).length as number
        const entry = reportsCache.set({ summary: nextSummary, total: nextTotal })
        setSummary(nextSummary)
        setTotal(nextTotal)
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
    try {
      const res = await authFetch("/api/admin/reports?format=csv")
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "registrations.csv"
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsExporting(false)
    }
  }

  if (isLoading) return <p className="text-center text-ink-soft">Loading reports...</p>

  return (
    <div className="cfca-page space-y-6">
      <DashboardSubnav />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-ink">
            Staff workspace
          </p>
          <h1 className="font-display text-4xl font-semibold text-ink">Reports</h1>
        </div>
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

      {fetchedAt != null && (
        <p className="text-sm text-ink-soft">
          Summary cached · updated {formatCacheAge(fetchedAt)}
        </p>
      )}
      {loadError && (
        <p className="text-sm text-[color:var(--danger)]" role="alert">
          {loadError}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Summary by State ({total} registrations)</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2">State</th>
                <th className="p-2">Registrations</th>
                <th className="p-2">Attendees</th>
                <th className="p-2">Spouses</th>
                <th className="p-2">Kids</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(summary).map(([state, data]) => (
                <tr key={state} className="border-b">
                  <td className="p-2 font-medium">{state}</td>
                  <td className="p-2">{data.registrations}</td>
                  <td className="p-2">{data.attendees}</td>
                  <td className="p-2">{data.spouses}</td>
                  <td className="p-2">{data.kids}</td>
                </tr>
              ))}
              {Object.keys(summary).length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-ink-soft">
                    No registration data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Button
          onClick={handleExport}
          isLoading={isExporting}
          loadingText="Exporting..."
          disabled={isExporting || isRefreshing}
          aria-label="Export detailed CSV"
        >
          Export Detailed CSV
        </Button>
        <p className="text-sm text-ink-soft">
          CSV is always generated fresh from the database and includes all non-secret
          registration fields (new columns are included automatically), plus attendees as JSON.
        </p>
      </div>
    </div>
  )
}

export default ReportsPage
