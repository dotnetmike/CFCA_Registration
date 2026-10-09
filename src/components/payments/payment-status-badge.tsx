import { cn } from "@/lib/utils"
import { formatPaymentStatus, type PaymentStatus } from "@/lib/payments/labels"

const STATUS_CLASSES: Record<PaymentStatus, string> = {
  paid: "bg-emerald-100 text-emerald-800",
  partial: "bg-sky-100 text-sky-800",
  overpaid: "bg-violet-100 text-violet-800",
  pending: "bg-amber-100 text-amber-900",
}

type PaymentStatusBadgeProps = {
  status: string | null | undefined
  className?: string
}

export const PaymentStatusBadge = ({ status, className }: PaymentStatusBadgeProps) => {
  const normalized = String(status ?? "").toLowerCase() as PaymentStatus
  const key: PaymentStatus = normalized in STATUS_CLASSES ? normalized : "pending"

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        STATUS_CLASSES[key],
        className
      )}
    >
      {formatPaymentStatus(key)}
    </span>
  )
}
