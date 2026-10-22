"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Download } from "lucide-react"
import { useAuth } from "@/lib/auth/context"
import { useBusyCursor } from "@/hooks/use-busy-cursor"
import { Button } from "@/components/ui/button"
import { HelpTooltip } from "@/components/ui/help-tooltip"
import { StatCard } from "@/components/dashboard/stat-card"
import { EmptyRow, PagedTableCard, paginate } from "@/components/reconciliation/paged-table-card"
import { formatCalendarDate, formatDateTime } from "@/components/reconciliation/format"
import { downloadBlobFile } from "@/lib/dashboard/download-csv"
import {
  BACKUP_HELP,
  BACKUPS_PERMISSION,
  formatFileSize,
  type RegistrationBackupView,
} from "@/lib/backups/types"

type BackupsResult = { backups?: RegistrationBackupView[]; error?: string }
type Notice = { variant: "success" | "error"; message: string }

const LOAD_ERROR = "Could not load backups."
const DOWNLOAD_ERROR = "Could not download the backup."

const BackupsPage = () => {
  const { user, authFetch } = useAuth()
  const router = useRouter()
  const [backups, setBackups] = useState<RegistrationBackupView[]>([])
  const [loadedAt, setLoadedAt] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState("")
  const [notice, setNotice] = useState<Notice | null>(null)
  const [page, setPage] = useState(1)
  useBusyCursor(isRefreshing || downloadingId !== null)

  const canManageBackups = !!user?.permissions.includes(BACKUPS_PERMISSION)

  const fetchBackups = useCallback(async (): Promise<BackupsResult> => {
    try {
      const res = await authFetch("/api/admin/registration-backups")
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return { error: data.error ?? LOAD_ERROR }
      return { backups: (data.backups ?? []) as RegistrationBackupView[] }
    } catch {
      return { error: LOAD_ERROR }
    }
  }, [authFetch])

  const applyBackupsResult = useCallback((result: BackupsResult) => {
    if (result.backups) {
      setBackups(result.backups)
      setLoadedAt(new Date().toISOString())
    }
    setLoadError(result.error ?? "")
    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (!user) return
    if (!canManageBackups) {
      router.push("/dashboard")
      return
    }
    let isCancelled = false
    void fetchBackups().then((result) => {
      if (!isCancelled) applyBackupsResult(result)
    })
    return () => {
      isCancelled = true
    }
  }, [user, canManageBackups, router, fetchBackups, applyBackupsResult])

  const completedBackups = useMemo(() => backups.filter((b) => b.status === "completed"), [backups])
  const latest = completedBackups[0] ?? null
  const totalBytes = completedBackups.reduce((sum, b) => sum + b.sizeBytes, 0)
  const { pageRows } = paginate(backups, page)

  const handleRefresh = async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    applyBackupsResult(await fetchBackups())
    setIsRefreshing(false)
  }

  const handleDownload = async (backup: RegistrationBackupView) => {
    if (downloadingId) return
    setDownloadingId(backup.id)
    setNotice(null)
    try {
      const res = await authFetch(`/api/admin/registration-backups/${backup.id}/download`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setNotice({ variant: "error", message: data.error ?? DOWNLOAD_ERROR })
        return
      }
      downloadBlobFile(backup.fileName, await res.blob())
      setNotice({ variant: "success", message: `Downloaded ${backup.fileName}.` })
    } catch {
      setNotice({ variant: "error", message: DOWNLOAD_ERROR })
    } finally {
      setDownloadingId(null)
    }
  }

  if (isLoading) return <p className="text-center text-ink-soft">Loading backups...</p>

  return (
    <div className="cfca-page space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-ink">Administration</p>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-4xl font-semibold text-ink">Registration Backups</h1>
            <HelpTooltip content={BACKUP_HELP.page} label="About registration backups" />
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleRefresh()}
          isLoading={isRefreshing}
          loadingText="Refreshing..."
          disabled={isRefreshing || downloadingId !== null}
          aria-label="Refresh backups list"
        >
          Refresh
        </Button>
      </div>

      {loadedAt ? (
        <p className="text-sm text-gray-500">
          Updated {formatDateTime(loadedAt)} · {backups.length} backup{backups.length === 1 ? "" : "s"}
        </p>
      ) : null}
      {loadError ? <p className="text-sm text-red-600" role="alert">{loadError}</p> : null}
      {notice ? (
        <p className={`text-sm ${notice.variant === "error" ? "text-red-600" : "text-emerald-700"}`} role="status">
          {notice.message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Backups"
          value={String(completedBackups.length)}
          hint="One per day, created automatically"
          tone="brand"
        />
        <StatCard
          label="Latest backup"
          value={latest ? formatCalendarDate(latest.backupDate) : "None yet"}
          hint={latest ? `${latest.registrationCount} registrations` : "Open the Registrations Dashboard to create one"}
          tone="success"
          className="animate-rise-delay-1"
        />
        <StatCard
          label="Storage used"
          value={formatFileSize(totalBytes)}
          hint="Zipped CSV files, private storage"
          tone="info"
          className="animate-rise-delay-2"
        />
      </div>

      <PagedTableCard
        title={`${backups.length} backup${backups.length === 1 ? "" : "s"}`}
        tableLabel="Registration backups table"
        total={backups.length}
        page={page}
        onPageChange={setPage}
        minWidthClass="min-w-[56rem]"
        header={
          <tr>
            <th className="cfca-registrations-table__sticky-left w-[8rem] whitespace-nowrap" scope="col">Backup date</th>
            <th className="min-w-[16rem]" scope="col">File</th>
            <th className="w-28 whitespace-nowrap text-right" scope="col">Registrations</th>
            <th className="w-24 whitespace-nowrap text-right" scope="col">Size</th>
            <th className="w-[10rem] whitespace-nowrap" scope="col">Created</th>
            <th className="min-w-[9rem]" scope="col" title="Admin whose dashboard visit created the backup">Triggered by</th>
            <th className="cfca-registrations-table__sticky-right w-[9rem] whitespace-nowrap text-right" scope="col">
              <span className="inline-flex items-center gap-1">
                Actions
                <HelpTooltip content={BACKUP_HELP.download} label="About downloading backups" />
              </span>
            </th>
          </tr>
        }
      >
        {pageRows.length === 0 ? (
          <EmptyRow
            colSpan={7}
            message="No backups yet. The first one is created when an admin opens the Registrations Dashboard."
          />
        ) : (
          pageRows.map((backup) => {
            const isCompleted = backup.status === "completed"
            const isDownloading = downloadingId === backup.id
            return (
              <tr key={backup.id}>
                <td className="cfca-registrations-table__sticky-left whitespace-nowrap font-semibold">
                  {formatCalendarDate(backup.backupDate)}
                </td>
                <td className="break-all text-xs">
                  {isCompleted ? backup.fileName : <span className="text-ink-soft">Being created...</span>}
                </td>
                <td className="text-right tabular-nums">{isCompleted ? backup.registrationCount : "—"}</td>
                <td className="whitespace-nowrap text-right tabular-nums">
                  {isCompleted ? formatFileSize(backup.sizeBytes) : "—"}
                </td>
                <td className="whitespace-nowrap text-xs">{formatDateTime(backup.completedAt ?? backup.createdAt)}</td>
                <td className="text-xs">{backup.createdByName ?? "—"}</td>
                <td className="cfca-registrations-table__sticky-right">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 shrink-0 gap-1.5 px-2.5 text-xs"
                      onClick={() => void handleDownload(backup)}
                      isLoading={isDownloading}
                      loadingText="Downloading..."
                      disabled={!isCompleted || downloadingId !== null}
                      aria-label={`Download backup for ${formatCalendarDate(backup.backupDate)}`}
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      Download
                    </Button>
                  </div>
                </td>
              </tr>
            )
          })
        )}
      </PagedTableCard>
    </div>
  )
}

export default BackupsPage
