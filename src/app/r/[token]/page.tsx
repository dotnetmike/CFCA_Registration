"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { StripeCheckoutReturn } from "@/components/payments/stripe-checkout-return"
import {
  RegistrationDetailsView,
  type RegistrationDetails,
} from "@/components/registrations/registration-details-view"
import type { PricingConfig } from "@/lib/pricing/calculate"

const MagicRegistrationContent = () => {
  const params = useParams<{ token: string }>()
  const searchParams = useSearchParams()
  const token = params.token
  const checkoutSessionId =
    searchParams.get("payment") === "success" ? searchParams.get("session_id") : null
  const [registration, setRegistration] = useState<RegistrationDetails | null>(null)
  const [hasAccount, setHasAccount] = useState(false)
  const [onlineEnabled, setOnlineEnabled] = useState(false)
  const [pricing, setPricing] = useState<PricingConfig | null>(null)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [reloadCount, setReloadCount] = useState(0)

  const handlePaymentConfirmed = useCallback(() => {
    setReloadCount((count) => count + 1)
  }, [])

  useEffect(() => {
    if (!token) return

    const load = async () => {
      const [res, settingsRes] = await Promise.all([
        fetch(`/api/registrations/view/${encodeURIComponent(token)}`),
        fetch("/api/registration-settings").catch(() => null),
      ])
      if (settingsRes?.ok) {
        const settingsData = await settingsRes.json().catch(() => ({}))
        setOnlineEnabled(
          settingsData.settings?.registrationWorkflow === "v2" &&
            settingsData.stripePaymentsEnabled === true
        )
        setPricing(settingsData.settings?.pricing ?? null)
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? "Invalid or expired link")
        setIsLoading(false)
        return
      }

      const data = await res.json()
      setRegistration(data.registration)
      setHasAccount(!!data.hasAccount)
      setIsLoading(false)
    }

    load()
  }, [token, reloadCount])

  if (isLoading) return <p className="text-center text-gray-500">Loading registration...</p>

  if (error || !registration) {
    return (
      <Alert variant="error">
        {error || "Registration not found."}{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>{" "}
        if you have an account.
      </Alert>
    )
  }

  const payHref = `/register/pay?view=${encodeURIComponent(token)}`
  const editHref = hasAccount
    ? `/login?redirect=${encodeURIComponent("/")}`
    : `/signup?email=${encodeURIComponent(registration.email)}&redirect=${encodeURIComponent("/")}`

  return (
    <div className="cfca-page mx-auto max-w-5xl space-y-6">
      {checkoutSessionId && (
        <StripeCheckoutReturn
          sessionId={checkoutSessionId}
          retryHref={payHref}
          onConfirmed={handlePaymentConfirmed}
        />
      )}

      <RegistrationDetailsView
        registration={registration}
        payHref={payHref}
        onlineEnabled={onlineEnabled}
        pricing={pricing}
        notice={
          <Alert variant="info">
            You are viewing this registration via a secure email link. To make changes,{" "}
            {hasAccount ? "log in" : "create an account"} first.
          </Alert>
        }
        actions={
          <>
            <Link href={editHref}>
              <Button aria-label="Create account or login to edit">
                {hasAccount ? "Log in to edit" : "Create account to edit"}
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline">Home</Button>
            </Link>
          </>
        }
      />
    </div>
  )
}

const MagicRegistrationPage = () => (
  <Suspense fallback={<p className="text-center text-gray-500">Loading registration...</p>}>
    <MagicRegistrationContent />
  </Suspense>
)

export default MagicRegistrationPage
