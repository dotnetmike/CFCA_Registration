import { cn } from "@/lib/utils"
import {
  AWAITING_STRIPE_EXPORT_LABEL,
  RECONCILIATION_HELP,
  RECONCILIATION_STATUS_HELP,
  RECONCILIATION_STATUS_LABELS,
} from "@/lib/reconciliation/labels"
import type { ReconciliationItemType, ReconciliationStatus } from "@/lib/reconciliation/types"

const STATUS_CLASSES: Record<ReconciliationStatus, string> = {
  matched: "bg-emerald-100 text-emerald-800",
  unmatched: "bg-amber-100 text-amber-900",
  ignored: "bg-slate-200 text-slate-700",
  not_applicable: "bg-sky-100 text-sky-800",
}

type ReconciliationStatusBadgeProps = {
  status: ReconciliationStatus
  itemType?: ReconciliationItemType
  manualOverride?: boolean
  awaitingStripeExport?: boolean
  className?: string
}

export const getStatusLabel = (status: ReconciliationStatus, itemType?: ReconciliationItemType) => {
  const label = RECONCILIATION_STATUS_LABELS[status]
  if (status !== "matched" && status !== "unmatched") return label
  if (itemType === "stripe") return `${label} Stripe`
  if (itemType === "bank") return `${label} bank`
  return label
}

export const ReconciliationStatusBadge = ({
  status,
  itemType,
  manualOverride,
  awaitingStripeExport,
  className,
}: ReconciliationStatusBadgeProps) => (
  <span className={cn("inline-flex flex-col items-start gap-1", className)}>
    {awaitingStripeExport ? (
      <span
        className="inline-flex items-center whitespace-nowrap rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800"
        title={RECONCILIATION_HELP.awaitingStripeExport}
      >
        {AWAITING_STRIPE_EXPORT_LABEL}
      </span>
    ) : (
      <span
        className={cn(
          "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
          STATUS_CLASSES[status]
        )}
        title={RECONCILIATION_STATUS_HELP[status]}
      >
        {getStatusLabel(status, itemType)}
      </span>
    )}
    {manualOverride ? (
      <span
        className="text-[0.7rem] font-semibold uppercase tracking-wide text-ink-soft"
        title="Set by an admin. Automatic matching will not change this row."
      >
        Admin set
      </span>
    ) : null}
  </span>
)
