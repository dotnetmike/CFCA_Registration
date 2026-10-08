"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Alert } from "@/components/ui/alert"
import { PaymentStep } from "@/components/payments/payment-step"
import { useAuth } from "@/lib/auth/context"
import {
  EMPTY_BANK_DETAILS,
  normalizeBankDetails,
  type BankDetails,
} from "@/lib/payments/bank-details"

type PayRegistration = {
  id: string
  registration_no: string
  participant_reference: string | null
  amount_due: number
  amount_paid: number
  payment_status: string
  given_name: string
  surname: string
}

const PayPageInner = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { authFetch, user, isLoading: authLoading } = useAuth()
  const signupToken = searchParams.get("token") ?? ""
  const viewToken = searchParams.get("view") ?? ""
  const isViewLinkPayment = !signupToken && !!viewToken
  const viewPagePath = `/r/${encodeURIComponent(viewToken)}`

  const [registration, setRegistration] = useState<PayRegistration | null>(null)
  const [showOnline, setShowOnline] = useState(false)
  const [bankDetails, setBankDetails] = useState<BankDetails>(EMPTY_BANK_DETAILS)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return

    const load = async () => {
      setError("")
      setIsLoading(true)

      if (signupToken || viewToken) {
        const payRes = await fetch(
          `/api/payments/pay-context?${
            signupToken
              ? `token=${encodeURIComponent(signupToken)}`
              : `view=${encodeURIComponent(viewToken)}`
          }`
        )
        if (!payRes.ok) {
          setError("Could not load registration for payment.")
          setIsLoading(false)
          return
        }
        const payData = await payRes.json()
        setRegistration(payData.registration)
        setShowOnline(
          (payData.registrationWorkflow ?? "v1") === "v2" &&
            payData.stripePaymentsEnabled === true
        )
        setBankDetails(normalizeBankDetails(payData.bankDetails))
        setIsLoading(false)
        return
      }

      if (!user) {
        setError("Missing payment link. Please use the link from your registration email.")
        setIsLoading(false)
        return
      }

      const [settingsRes, regRes] = await Promise.all([
        fetch("/api/registration-settings"),
        authFetch("/api/registrations?mine=true"),
      ])

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        const workflow = settingsData.settings?.registrationWorkflow ?? "v1"
        setShowOnline(workflow === "v2" && settingsData.stripePaymentsEnabled === true)
        setBankDetails(normalizeBankDetails(settingsData.settings?.bankDetails))
      }

      if (!regRes.ok) {
        setError("Could not load your registration for payment.")
        setIsLoading(false)
        return
      }

      const data = await regRes.json()
      if (!data.registration) {
        setError("No submitted registration found.")
        setIsLoading(false)
        return
      }
      setRegistration(data.registration)
      setIsLoading(false)
    }

    void load()
  }, [authFetch, authLoading, signupToken, user, viewToken])

  const goComplete = (payment: "bank") => {
    if (isViewLinkPayment) {
      router.push(viewPagePath)
      return
    }
    if (signupToken || viewToken) {
      const params = new URLSearchParams()
      if (signupToken) params.set("token", signupToken)
      if (viewToken) params.set("view", viewToken)
      params.set("payment", payment)
      router.push(`/register/complete?${params.toString()}`)
      return
    }
    router.push("/my-registration")
  }

  if (authLoading || isLoading) {
    return <p className="text-center text-ink-soft">Loading payment options...</p>
  }

  if (error || !registration) {
    return <Alert variant="error">{error || "Registration not found"}</Alert>
  }

  const uniqueCode =
    registration.participant_reference ??
    (registration.registration_no && !registration.registration_no.startsWith("DRAFT")
      ? registration.registration_no
      : "")

  if (!uniqueCode) {
    return (
      <Alert variant="warning">
        Unique Code is not ready yet. Please contact the registration team.
      </Alert>
    )
  }

  return (
    <div className="cfca-page mx-auto max-w-2xl space-y-6">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-ink">
          {isViewLinkPayment ? "Registration payment" : "Step 2 of 3"}
        </p>
        <h1 className="font-display text-4xl font-semibold text-ink">Payment</h1>
        <p className="text-ink-soft">
          {isViewLinkPayment
            ? "Pay your remaining balance online, or choose bank transfer."
            : "Your registration is saved. Pay online now, or choose bank transfer."}
        </p>
        <div className="accent-rule" aria-hidden />
      </div>

      <PaymentStep
        registration={registration}
        uniqueCode={uniqueCode}
        showOnline={showOnline}
        bankDetails={bankDetails}
        checkoutCancelled={searchParams.get("payment") === "cancelled"}
        signupToken={signupToken || undefined}
        viewToken={viewToken || undefined}
        registrationId={registration.id}
        authFetch={user ? authFetch : undefined}
        onBankContinue={() => goComplete("bank")}
        successPath={isViewLinkPayment ? viewPagePath : undefined}
      />
      {isViewLinkPayment && (
        <Link
          href={viewPagePath}
          className="inline-block text-sm font-medium text-accent-ink underline-offset-2 hover:underline"
        >
          ← Back to registration details
        </Link>
      )}
    </div>
  )
}

const RegisterPayPage = () => (
  <Suspense fallback={<p className="text-center text-ink-soft">Loading...</p>}>
    <PayPageInner />
  </Suspense>
)

export default RegisterPayPage
