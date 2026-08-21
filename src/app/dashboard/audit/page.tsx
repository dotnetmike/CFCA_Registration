"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useBusyCursor } from "@/hooks/use-busy-cursor"
import {
  DASHBOARD_LIST_CACHE_MAX_ROWS,
  DASHBOARD_PAGE_SIZE,
  formatCacheAge,
} from "@/lib/dashboard/list-cache"
import {
  auditListCache,
  type DashboardAuditRow,
} from "@/lib/dashboard/audit-list-cache"

const formatJson = (value: Record<string, unknown> | null) => {
  if (!value || Object.keys(value).length === 0) return "—"
  return JSON.stringify(value, null, 2)
}

const AuditLogPage = () => {
  const { user, authFetch } = useAuth()
  const router = useRouter()
  const [logs, setLogs] = useState<DashboardAuditRow[]>([])
  const [serverTotal, setServerTotal] = useState<number | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState("")
  useBusyCursor(isRefreshing)

  const loadLogs = useCallback(
    async (forceRefresh: boolean) => {
      if (!forceRefresh) {
        const cached = auditListCache.get()
        if (cached?.isFresh) {
          setLogs(cached.rows)
          setFetchedAt(cached.fetchedAt)
          setIsLoading(false)
          return
        }
        if (cached) {
          setLogs(cached.rows)
          setFetchedAt(cached.fetchedAt)
          setIsLoading(false)
        }
      } else {
        auditListCache.clear()
      }

      if (forceRefresh) setIsRefreshing(true)
      else if (!auditListCache.get()) setIsLoading(true)

      setLoadError("")
      try {
        const res = await authFetch(
          `/api/admin/audit-log?limit=${DASHBOARD_LIST_CACHE_MAX_ROWS}&offset=0`
        )
        if (!res.ok) {
          setLoadError("Could not load audit log.")
          return
        }
        const data = await res.json()
        const entry = auditListCache.set((data.logs ?? []) as DashboardAuditRow[])
        setLogs(entry.rows)
        setFetchedAt(entry.fetchedAt)
        setServerTotal(typeof data.total === "number" ? data.total : entry.rows.length)
      } catch {
        setLoadError("Could not load audit log.")
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [authFetch]
  )

  useEffect(() => {
    if (!user) return
    if (!user.permissions.includes("users:manage")) {
      router.push("/")
      return
    }
    void loadLogs(false)
  }, [user, router, loadLogs])

  const totalPages = Math.max(1, Math.ceil(logs.length / DASHBOARD_PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * DASHBOARD_PAGE_SIZE
  const pageRows = useMemo(
    () => logs.slice(pageStart, pageStart + DASHBOARD_PAGE_SIZE),
    [logs, pageStart]
  )
  const rangeStart = logs.length === 0 ? 0 : pageStart + 1
  const rangeEnd = Math.min(pageStart + DASHBOARD_PAGE_SIZE, logs.length)

  if (isLoading) return <p className="text-center text-ink-soft">Loading audit log...</p>

  return (
    <div className="cfca-page space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-ink">
            Administration
          </p>
          <h1 className="font-display text-4xl font-semibold text-ink">Audit Log</h1>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void loadLogs(true)}
          isLoading={isRefreshing}
          loadingText="Refreshing..."
          disabled={isRefreshing}
          aria-label="Refresh audit log"
        >
          Refresh
        </Button>
      </div>

      {fetchedAt != null && (
        <p className="text-sm text-ink-soft">
          List data cached · updated {formatCacheAge(fetchedAt)} · {logs.length} loaded
          {serverTotal != null && serverTotal > logs.length
            ? ` (of ${serverTotal} total — showing most recent ${DASHBOARD_LIST_CACHE_MAX_ROWS})`
            : ""}
        </p>
      )}
      {loadError && (
        <p className="text-sm text-[color:var(--danger)]" role="alert">
          {loadError}
        </p>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Recent Actions</CardTitle>
          <p className="text-sm text-ink-soft" aria-live="polite">
            Showing {rangeStart}–{rangeEnd} · Page {currentPage} of {totalPages} ·{" "}
            {DASHBOARD_PAGE_SIZE} per page
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2">Date/Time</th>
                  <th className="p-2">User</th>
                  <th className="p-2">Action</th>
                  <th className="p-2">Previous Value</th>
                  <th className="p-2">Updated Value</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((log) => (
                  <tr key={log.id} className="border-b align-top">
                    <td className="whitespace-nowrap p-2">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="p-2">
                      {log.users ? (
                        <div>
                          <div className="font-medium">{log.users.name}</div>
                          <div className="text-xs text-ink-soft">{log.users.email}</div>
                        </div>
                      ) : (
                        <span className="text-ink-soft">—</span>
                      )}
                    </td>
                    <td className="p-2 font-mono text-xs">{log.action}</td>
                    <td className="p-2">
                      <pre className="max-w-xs overflow-x-auto whitespace-pre-wrap text-xs text-ink-soft">
                        {formatJson(log.previous_value)}
                      </pre>
                    </td>
                    <td className="p-2">
                      <pre className="max-w-xs overflow-x-auto whitespace-pre-wrap text-xs text-ink-soft">
                        {formatJson(log.updated_value)}
                      </pre>
                    </td>
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-ink-soft">
                      No audit entries yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || isRefreshing}
              aria-label="Previous page"
            >
              Previous
            </Button>
            <p className="text-sm text-ink-soft">
              Page {currentPage} of {totalPages}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || isRefreshing}
              aria-label="Next page"
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default AuditLogPage
