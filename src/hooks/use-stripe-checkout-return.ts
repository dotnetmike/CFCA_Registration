"use client"

import { useEffect, useRef } from "react"

/**
 * After Stripe Checkout redirect, confirm the session via secret-key API
 * so the ledger updates even if the webhook is delayed.
 */
export const useStripeCheckoutReturn = (sessionId: string | null) => {
  const ranFor = useRef<string | null>(null)

  useEffect(() => {
    if (!sessionId || ranFor.current === sessionId) return
    ranFor.current = sessionId

    void fetch(
      `/api/payments/stripe/status?session_id=${encodeURIComponent(sessionId)}`
    ).catch(() => {
      // webhook may still fulfill; non-blocking
    })
  }, [sessionId])
}
