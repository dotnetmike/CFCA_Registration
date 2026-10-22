"use client"

import { useRef, useState, type ChangeEvent, type ReactNode } from "react"
import { Upload } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { HelpTooltip } from "@/components/ui/help-tooltip"
import { formatDateTime } from "@/components/reconciliation/format"
import type { ReconciliationRunView } from "@/lib/reconciliation/types"

type UploadCardProps = {
  id: string
  title: string
  description: ReactNode
  help: string
  lastRun: ReconciliationRunView | null
  isUploading: boolean
  disabled: boolean
  onUpload: (file: File) => Promise<boolean>
}

export const UploadCard = ({
  id,
  title,
  description,
  help,
  lastRun,
  isUploading,
  disabled,
  onUpload,
}: UploadCardProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null)
  }

  const handleUpload = async () => {
    if (!file || isUploading || disabled) return
    const ok = await onUpload(file)
    if (!ok) return
    setFile(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">{title}</CardTitle>
          <HelpTooltip content={help} label={`How to export the ${title}`} />
        </div>
        <p className="text-sm text-ink-soft">{description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <label htmlFor={id} className="sr-only">
          Choose {title} CSV file
        </label>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          disabled={isUploading || disabled}
          className="block w-full text-sm text-ink file:mr-3 file:rounded-md file:border file:border-[color:var(--line-strong)] file:bg-mist file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            size="sm"
            onClick={() => void handleUpload()}
            isLoading={isUploading}
            loadingText="Reconciling..."
            disabled={!file || isUploading || disabled}
            aria-label={`Upload and reconcile ${title}`}
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            Upload &amp; reconcile
          </Button>
          <p className="text-xs text-ink-soft">
            {lastRun
              ? `Last upload ${formatDateTime(lastRun.createdAt)}${lastRun.filename ? ` · ${lastRun.filename}` : ""}`
              : "No uploads yet"}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
