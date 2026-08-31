"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth/context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert } from "@/components/ui/alert"
import { PaymentReferenceMockup } from "@/components/registrations/payment-reference-mockup"
import { formatCurrency } from "@/lib/pricing/calculate"

const PaymentPage = () => {
  const { authFetch } = useAuth()
  const [registration, setRegistration] = useState<{
    registration_no: string
    participant_reference: string | null
    amount_due: number
    amount_paid: number
    payment_status: string
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const res = await authFetch("/api/registrations?mine=true")
      if (res.ok) {
        const data = await res.json()
        setRegistration(data.registration)
      }
      setIsLoading(false)
    }
    load()
  }, [authFetch])

  if (isLoading) {
    return <p className="text-center text-ink-soft">Loading...</p>
  }

  const paymentReference =
    registration?.participant_reference ??
    (registration?.registration_no && !registration.registration_no.startsWith("DRAFT")
      ? registration.registration_no
      : null)

  if (!registration || !paymentReference) {
    return (
      <Alert variant="warning">
        Please complete your personal details (step 1) to receive your Unique Code.
      </Alert>
    )
  }

  const outstanding = Number(registration.amount_due) - Number(registration.amount_paid)
  const paymentAmount = outstanding > 0 ? outstanding : Number(registration.amount_due)

  return (
    <div className="cfca-page mx-auto max-w-2xl">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-ink">
          Bank transfer
        </p>
        <h1 className="font-display text-4xl font-semibold text-ink">Payment Information</h1>
        <div className="accent-rule" aria-hidden />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Registration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>Unique Code:</strong>{" "}
            <span className="font-bold text-[color:var(--danger)]">{paymentReference}</span>
          </p>
          {registration.registration_no && !registration.registration_no.startsWith("DRAFT") && (
            <p><strong>Registration No:</strong> {registration.registration_no}</p>
          )}
          <p><strong>Amount Due:</strong> {formatCurrency(Number(registration.amount_due))}</p>
          <p><strong>Amount Paid:</strong> {formatCurrency(Number(registration.amount_paid))}</p>
          <p><strong>Remaining balance:</strong>{" "}
            <span className={outstanding > 0 ? "font-semibold text-accent-ink" : ""}>
              {formatCurrency(Math.max(0, outstanding))}
            </span>
          </p>
          <p><strong>Status:</strong> {registration.payment_status}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bank Transfer Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>Account Name:</strong> {process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME ?? "CFCA Conference"}</p>
          <p><strong>BSB:</strong> {process.env.NEXT_PUBLIC_BANK_BSB ?? "000-000"}</p>
          <p><strong>Account Number:</strong> {process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER ?? "00000000"}</p>
        </CardContent>
      </Card>

      <Alert variant="info">
        If you have paid and still receive payment reminder emails, please contact the registration team.
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>How to Pay</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="info">
            <strong>IMPORTANT:</strong> Please include your{" "}
            <strong>Unique Code</strong> in both Message and Ref. when paying via your bank app.
          </Alert>
          <PaymentReferenceMockup uniqueCode={paymentReference} amount={paymentAmount} />
        </CardContent>
      </Card>
    </div>
  )
}

export default PaymentPage
