"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CircleCheck, DatabaseBackup, LoaderCircle, TriangleAlert } from "lucide-react"
import { useAuth } from "@/lib/auth/context"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "@/components/reconciliation/format"
import { formatFileSize, type EnsureDailyBackupResult } from "@/lib/backups/types"

type AuthFetch = ReturnType<typeof useAuth>["authFetch"]

type BackupState =
  | { kind: "checking" }
  | { kind: "ready"; result: EnsureDailyBackupResult }
  | { kind: "error"; message: string }

const DAILY_BACKUP_ERROR = "Today's backup could not be created."
const POLL_INTERVAL_MS = 3000
const MAX_POLLS = 20

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const requestDailyBackup = async (authFetch: AuthFetch): Promise<BackupState> => {
  try {
    const res = await authFetch("/api/admin/registration-backups/daily", { method: "POST" })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { kind: "error", message: data.error ?? DAILY_BACKUP_ERROR }
    return { kind: "ready", result: data as EnsureDailyBackupResult }
  } catch {
    return { kind: "error", message: DAILY_BACKUP_ERROR }
  }
}

const isProcessing = (state: BackupState) =>
  state.kind === "ready" && state.result.backup.status === "processing"

/** Requests today's backup; while another visit is still creating it, polls until it completes. */
const runDailyBackup = async (authFetch: AuthFetch, isCancelled: () => boolean) => {
  let state = await requestDailyBackup(authFetch)
  for (let poll = 0; poll < MAX_POLLS && isProcessing(state) && !isCancelled(); poll += 1) {
    await wait(POLL_INTERVAL_MS)
    state = await requestDailyBackup(authFetch)
  }
  return state
}

const describeReadyState = ({ backup, created }: EnsureDailyBackupResult) => {
  if (backup.status === "processing") {
    return "Today's registration backup is still being created. It will appear on the Backups page when it is ready."
  }
  const summary = `${backup.registrationCount} registration${backup.registrationCount === 1 ? "" : "s"}, ${formatFileSize(backup.sizeBytes)}`
  if (created) return `Today's registration backup was created just now (${summary}).`
  const by = backup.createdByName ? ` by ${backup.createdByName}` : ""
  return `Today's registration backup was created ${formatDateTime(backup.completedAt ?? backup.createdAt)}${by} (${summary}).`
}

export const DailyBackupStatus = () => {
  const { authFetch } = useAuth()
  const [state, setState] = useState<BackupState>({ kind: "checking" })
  const [isRetrying, setIsRetrying] = useState(false)

  useEffect(() => {
    let isCancelled = false
    void runDailyBackup(authFetch, () => isCancelled).then((next) => {
      if (!isCancelled) setState(next)
    })
    return () => {
      isCancelled = true
    }
  }, [authFetch])

  const handleRetry = async () => {
    if (isRetrying) return
    setIsRetrying(true)
    setState({ kind: "checking" })
    setState(await runDailyBackup(authFetch, () => false))
    setIsRetrying(false)
  }

  const isError = state.kind === "error"

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-4 py-2.5 text-sm ${
        isError
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-[color:var(--line)] bg-surface/80 text-ink-soft"
      }`}
    >
      {state.kind === "checking" || isProcessing(state) ? (
        <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-accent-ink" aria-hidden="true" />
      ) : null}
      {state.kind === "ready" && !isProcessing(state) ? (
        <CircleCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
      ) : null}
      {isError ? <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}

      <p className="min-w-0 flex-1">
        {state.kind === "checking" ? "Checking today's registration backup..." : null}
        {state.kind === "ready" ? describeReadyState(state.result) : null}
        {state.kind === "error" ? state.message : null}
      </p>

      {isError ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs"
          onClick={() => void handleRetry()}
          isLoading={isRetrying}
          loadingText="Retrying..."
          disabled={isRetrying}
          aria-label="Retry today's registration backup"
        >
          Retry
        </Button>
      ) : null}
      <Link
        href="/dashboard/backups"
        className="inline-flex items-center gap-1.5 font-semibold text-accent-ink underline-offset-4 hover:text-ink hover:underline"
      >
        <DatabaseBackup className="h-4 w-4" aria-hidden="true" />
        View backups
      </Link>
    </div>
  )
}
