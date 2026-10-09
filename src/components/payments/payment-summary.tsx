import { formatCurrency } from "@/lib/pricing/calculate"
import { PAYMENT_LABELS, balanceDue } from "@/lib/payments/labels"
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge"

type PaymentSummaryProps = {
  amountDue: unknown
  amountPaid: unknown
  status: string | null | undefined
}

/**
 * Status first, then fee and amount paid. Balance due is shown only when money is still owed.
 */
export const PaymentSummary = ({ amountDue, amountPaid, status }: PaymentSummaryProps) => {
  const balance = balanceDue(amountDue, amountPaid)

  return (
    <dl className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <dt className="font-bold">{PAYMENT_LABELS.status}:</dt>
        <dd>
          <PaymentStatusBadge status={status} />
        </dd>
      </div>
      <div className="flex gap-1">
        <dt className="font-bold">{PAYMENT_LABELS.fee}:</dt>
        <dd>{formatCurrency(Number(amountDue ?? 0))}</dd>
      </div>
      <div className="flex gap-1">
        <dt className="font-bold">{PAYMENT_LABELS.paid}:</dt>
        <dd>{formatCurrency(Number(amountPaid ?? 0))}</dd>
      </div>
      {balance > 0 && (
        <div className="flex gap-1">
          <dt className="font-bold">{PAYMENT_LABELS.balanceDue}:</dt>
          <dd className="font-semibold text-accent-ink">{formatCurrency(balance)}</dd>
        </div>
      )}
    </dl>
  )
}
