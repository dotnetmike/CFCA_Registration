"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { StripeCheckoutReturn } from "@/components/payments/stripe-checkout-return"
import {
  RegistrationDetailsView,
  type RegistrationDetails,
} from "@/components/registrations/registration-details-view"
import type { PricingConfig } from "@/lib/pricing/calculate"
import { useAuth } from "@/lib/auth/context"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

const MyRegistrationContent = () => {
  const { authFetch } = useAuth()
  const searchParams = useSearchParams()
  const checkoutSessionId =
    searchParams.get("payment") === "success" ? searchParams.get("session_id") : null
  const [registration, setRegistration] = useState<RegistrationDetails | null>(null)
  const [onlineEnabled, setOnlineEnabled] = useState(false)
  const [pricing, setPricing] = useState<PricingConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const load = async () => {
      const [res, settingsRes] = await Promise.all([
        authFetch("/api/registrations?mine=true"),
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
      if (res.ok) {
        const data = await res.json()
        setRegistration(data.registration)
      }
      setIsLoading(false)
    }
    load()
  }, [authFetch, reloadKey])

  const handlePaymentConfirmed = useCallback(() => {
    setReloadKey((key) => key + 1)
  }, [])

  return (
    <div className="cfca-page mx-auto max-w-5xl space-y-6">
      <StripeCheckoutReturn
        sessionId={checkoutSessionId}
        retryHref="/payment"
        onConfirmed={handlePaymentConfirmed}
      />
      <MyRegistrationBody
        isLoading={isLoading}
        registration={registration}
        onlineEnabled={onlineEnabled}
        pricing={pricing}
      />
    </div>
  )
}

type MyRegistrationBodyProps = {
  isLoading: boolean
  registration: RegistrationDetails | null
  onlineEnabled: boolean
  pricing: PricingConfig | null
}

const MyRegistrationBody = ({ isLoading, registration, onlineEnabled, pricing }: MyRegistrationBodyProps) => {
  if (isLoading) return <p className="text-center text-gray-500">Loading...</p>

  if (!registration) {
    return (
      <Alert variant="info">
        You haven&apos;t started a registration yet.{" "}
        <Link href="/" className="text-blue-600 underline">
          Start registration
        </Link>
      </Alert>
    )
  }

  return (
    <RegistrationDetailsView
      registration={registration}
      payHref="/payment"
      onlineEnabled={onlineEnabled}
      pricing={pricing}
      actions={
        <>
          <Link href="/">
            <Button aria-label="Edit registration">Edit registration</Button>
          </Link>
          {registration.submitted_at && (
            <Link href="/payment">
              <Button variant="outline" aria-label="View payment details">
                View payment details
              </Button>
            </Link>
          )}
        </>
      }
    />
  )
}

const MyRegistrationPage = () => (
  <Suspense fallback={<p className="text-center text-gray-500">Loading...</p>}>
    <MyRegistrationContent />
  </Suspense>
)

export default MyRegistrationPage
