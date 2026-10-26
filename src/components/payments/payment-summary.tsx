import type { ReactNode } from "react"
import { formatCurrency } from "@/lib/pricing/calculate"
import { PAYMENT_LABELS, balanceDue } from "@/lib/payments/labels"
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge"
import { cn } from "@/lib/utils"

type PaymentSummaryProps = {
  amountDue: unknown
  amountPaid: unknown
  status: string | null | undefined
  /** Hide when the page header already shows the status badge. */
  showStatus?: boolean
  title?: string
  /** Actions (e.g. pay button) rendered under the amounts. */
  children?: ReactNode
  className?: string
}

const AmountRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-4">
    <dt className="text-sm font-medium text-[#64748B]">{label}</dt>
    <dd className="text-[15px] font-medium tabular-nums text-[#172033]">{value}</dd>
  </div>
)

/**
 * Status first, then fee and amount paid. Balance due is shown (large) only when money is still owed.
 */
export const PaymentSummary = ({
  amountDue,
  amountPaid,
  status,
  showStatus = true,
  title = "Payment summary",
  children,
  className,
}: PaymentSummaryProps) => {
  const balance = balanceDue(amountDue, amountPaid)

  return (
    <section
      aria-label={title}
      className={cn(
        "rounded-xl border border-[#E2E8F0] bg-[#F2F6FC] p-5 sm:p-6",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-[#1E5AA8]">{title}</h2>
        {showStatus ? (
          <span className="inline-flex items-center gap-2">
            <span className="sr-only">{PAYMENT_LABELS.status}:</span>
            <PaymentStatusBadge status={status} />
          </span>
        ) : null}
      </div>
      <dl className="mt-4 space-y-3">
        <AmountRow label={PAYMENT_LABELS.fee} value={formatCurrency(Number(amountDue ?? 0))} />
        <AmountRow label={PAYMENT_LABELS.paid} value={formatCurrency(Number(amountPaid ?? 0))} />
        {balance > 0 && (
          <div className="border-t border-[#E2E8F0] pt-4">
            <dt className="text-base font-semibold text-[#172033]">{PAYMENT_LABELS.balanceDue}</dt>
            <dd className="mt-1 text-[1.75rem] font-bold leading-tight tracking-tight tabular-nums text-[#172033] sm:text-[2rem]">
              {formatCurrency(balance)}
            </dd>
          </div>
        )}
      </dl>
      {children ? <div className="mt-5 space-y-3">{children}</div> : null}
    </section>
  )
}
