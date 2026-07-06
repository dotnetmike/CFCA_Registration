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
      const res = await authFetch("/api/registrations")
      if (res.ok) {
        const data = await res.json()
        setRegistration(data.registration)
      }
      setIsLoading(false)
    }
    load()
  }, [authFetch])

  if (isLoading) {
    return <p className="text-center text-gray-500">Loading...</p>
  }

  const paymentReference =
    registration?.participant_reference ??
    (registration?.registration_no && !registration.registration_no.startsWith("DRAFT")
      ? registration.registration_no
      : null)

  if (!registration || !paymentReference) {
    return (
      <Alert variant="warning">
        Please complete your personal details (step 1) to receive your unique payment reference.
      </Alert>
    )
  }

  const outstanding = Number(registration.amount_due) - Number(registration.amount_paid)
  const paymentAmount = outstanding > 0 ? outstanding : Number(registration.amount_due)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Payment Information</h1>

      <Card>
        <CardHeader>
          <CardTitle>Your Registration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>Payment Reference:</strong>{" "}
            <span className="font-bold text-red-600">{paymentReference}</span>
          </p>
          {registration.registration_no && !registration.registration_no.startsWith("DRAFT") && (
            <p><strong>Registration No:</strong> {registration.registration_no}</p>
          )}
          <p><strong>Amount Due:</strong> {formatCurrency(Number(registration.amount_due))}</p>
          <p><strong>Amount Paid:</strong> {formatCurrency(Number(registration.amount_paid))}</p>
          <p><strong>Status:</strong> {registration.payment_status}</p>
          {outstanding > 0 && (
            <p className="font-semibold text-amber-700">
              Outstanding: {formatCurrency(outstanding)}
            </p>
          )}
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
