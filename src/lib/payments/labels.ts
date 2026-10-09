/** Single source of truth for payment wording across UI, emails, and admin. */
export const PAYMENT_LABELS = {
  fee: "Registration fee",
  paid: "Amount paid",
  balanceDue: "Balance due",
  status: "Payment status",
} as const

export const PAYMENT_STATUSES = ["pending", "partial", "paid", "overpaid"] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Unpaid",
  partial: "Part paid",
  paid: "Paid",
  overpaid: "Overpaid",
}

export const formatPaymentStatus = (status: string | null | undefined) => {
  const key = String(status ?? "").toLowerCase() as PaymentStatus
  return PAYMENT_STATUS_LABELS[key] ?? PAYMENT_STATUS_LABELS.pending
}

export const balanceDue = (registrationFee: unknown, amountPaid: unknown) =>
  Math.max(0, Number(registrationFee ?? 0) - Number(amountPaid ?? 0))
