"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Alert } from "@/components/ui/alert"

type ReturnState =
  | "idle"
  | "confirming"
  | "succeeded"
  | "processing"
  | "failed"
  | "expired"
  | "timeout"

type StripeCheckoutReturnProps = {
  sessionId: string | null
  retryHref: string
  onConfirmed?: () => void
}

const POLL_INTERVAL_MS = 3_000
const POLL_TIMEOUT_MS = 45_000
const REQUEST_TIMEOUT_MS = 10_000

const fetchOutcome = async (sessionId: string): Promise<string | null> => {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(
      `/api/payments/stripe/status?session_id=${encodeURIComponent(sessionId)}`,
      { signal: controller.signal, cache: "no-store" }
    )
    if (!res.ok) return null
    const data = await res.json().catch(() => ({}))
    return typeof data.outcome === "string" ? data.outcome : null
  } catch {
    return null
  } finally {
    window.clearTimeout(timeoutId)
  }
}

/** Confirms a Stripe Checkout Session after redirect, polling until a final outcome or timeout. */
export const StripeCheckoutReturn = ({
  sessionId,
  retryHref,
  onConfirmed,
}: StripeCheckoutReturnProps) => {
  const [state, setState] = useState<ReturnState>(sessionId ? "confirming" : "idle")

  useEffect(() => {
    if (!sessionId) return

    let cancelled = false
    const startedAt = Date.now()

    const poll = async () => {
      while (!cancelled) {
        const outcome = await fetchOutcome(sessionId)
        if (cancelled) return

        if (outcome === "succeeded") {
          setState("succeeded")
          onConfirmed?.()
          return
        }
        if (outcome === "failed" || outcome === "open") {
          setState("failed")
          return
        }
        if (outcome === "expired") {
          setState("expired")
          return
        }
        if (outcome === "processing") setState("processing")

        if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
          setState("timeout")
          return
        }
        await new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS))
      }
    }

    void poll()
    return () => {
      cancelled = true
    }
  }, [sessionId, onConfirmed])

  if (state === "idle") return null

  if (state === "confirming" || state === "processing") {
    return (
      <Alert variant="info">
        <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden
          />
          {state === "processing"
            ? "Your payment is processing with your bank. This can take a moment..."
            : "Confirming your online payment..."}
        </span>
      </Alert>
    )
  }

  if (state === "succeeded") {
    return (
      <Alert variant="success">
        Online payment received. Thank you — your registration payment is up to date.
      </Alert>
    )
  }

  if (state === "failed" || state === "expired") {
    return (
      <Alert variant="error">
        {state === "expired"
          ? "Your payment session expired before it was completed. You have not been charged."
          : "Your online payment did not go through. You have not been charged."}{" "}
        <Link href={retryHref} className="font-semibold underline">
          Try again or pay by bank transfer
        </Link>
      </Alert>
    )
  }

  return (
    <Alert variant="warning">
      We could not confirm your payment yet. If you completed payment, it will appear on your
      registration shortly and we will email you a receipt. Please do not pay again.{" "}
      <Link href={retryHref} className="font-semibold underline">
        View payment status
      </Link>
    </Alert>
  )
}
