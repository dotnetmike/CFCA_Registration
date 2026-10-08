"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth/context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert } from "@/components/ui/alert"
import { PaymentReferenceMockup } from "@/components/registrations/payment-reference-mockup"
import { PaymentStep } from "@/components/payments/payment-step"
import { BankTransferDetails } from "@/components/payments/bank-transfer-details"
import { formatCurrency } from "@/lib/pricing/calculate"
import {
  EMPTY_BANK_DETAILS,
  normalizeBankDetails,
  type BankDetails,
} from "@/lib/payments/bank-details"

const PaymentPageContent = () => {
  const { authFetch } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [registration, setRegistration] = useState<{
    id: string
    registration_no: string
    participant_reference: string | null
    amount_due: number
    amount_paid: number
    payment_status: string
    given_name?: string
    surname?: string
  } | null>(null)
  const [useV2PayStep, setUseV2PayStep] = useState(false)
  const [showOnline, setShowOnline] = useState(false)
  const [bankDetails, setBankDetails] = useState<BankDetails>(EMPTY_BANK_DETAILS)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [regRes, settingsRes] = await Promise.all([
        authFetch("/api/registrations?mine=true"),
        fetch("/api/registration-settings"),
      ])
      if (regRes.ok) {
        const data = await regRes.json()
        setRegistration(data.registration)
      }
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        const workflow = settingsData.settings?.registrationWorkflow ?? "v1"
        const stripeOn = settingsData.stripePaymentsEnabled === true
        setUseV2PayStep(workflow === "v2")
        setShowOnline(workflow === "v2" && stripeOn)
        setBankDetails(normalizeBankDetails(settingsData.settings?.bankDetails))
      }
      setIsLoading(false)
    }
    void load()
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

  if (useV2PayStep) {
    return (
      <div className="cfca-page mx-auto max-w-2xl space-y-6">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-ink">
            Remaining balance
          </p>
          <h1 className="font-display text-4xl font-semibold text-ink">Payment</h1>
          <div className="accent-rule" aria-hidden />
        </div>
        <PaymentStep
          registration={registration}
          uniqueCode={paymentReference}
          showOnline={showOnline}
          bankDetails={bankDetails}
          registrationId={registration.id}
          authFetch={authFetch}
          onBankContinue={() => router.push("/my-registration")}
          checkoutCancelled={searchParams.get("payment") === "cancelled"}
        />
      </div>
    )
  }

  return (
    <div className="cfca-page mx-auto max-w-2xl space-y-6">
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
          <p>
            <strong>Unique Code:</strong>{" "}
            <span className="font-bold text-[color:var(--danger)]">{paymentReference}</span>
          </p>
          {registration.registration_no && !registration.registration_no.startsWith("DRAFT") && (
            <p>
              <strong>Registration No:</strong> {registration.registration_no}
            </p>
          )}
          <p>
            <strong>Amount Due:</strong> {formatCurrency(Number(registration.amount_due))}
          </p>
          <p>
            <strong>Amount Paid:</strong> {formatCurrency(Number(registration.amount_paid))}
          </p>
          <p>
            <strong>Remaining balance:</strong>{" "}
            <span className={outstanding > 0 ? "font-semibold text-accent-ink" : ""}>
              {formatCurrency(Math.max(0, outstanding))}
            </span>
          </p>
          <p>
            <strong>Status:</strong> {registration.payment_status}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bank Transfer Details</CardTitle>
        </CardHeader>
        <CardContent>
          <BankTransferDetails bankDetails={bankDetails} />
        </CardContent>
      </Card>

      <Alert variant="info">
        If you have paid and still receive payment reminder emails, please contact the
        registration team.
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

const PaymentPage = () => (
  <Suspense fallback={<p className="text-center text-ink-soft">Loading...</p>}>
    <PaymentPageContent />
  </Suspense>
)

export default PaymentPage
