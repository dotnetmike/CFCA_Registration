"use client"

import { useState, type ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { PaymentReferenceMockup } from "@/components/registrations/payment-reference-mockup"
import { PaymentMethodBadges } from "@/components/payments/payment-method-badges"
import { BankTransferDetails } from "@/components/payments/bank-transfer-details"
import type { BankDetails } from "@/lib/payments/bank-details"
import { formatCurrency } from "@/lib/pricing/calculate"
import { cn } from "@/lib/utils"
import { useBusyCursor } from "@/hooks/use-busy-cursor"

type PaymentMethod = "online" | "bank"

export type PaymentStepRegistration = {
  registration_no?: string
  participant_reference: string | null
  amount_due: number
  amount_paid: number
  payment_status: string
  given_name?: string
  surname?: string
}

type PaymentStepProps = {
  registration: PaymentStepRegistration
  uniqueCode: string
  showOnline: boolean
  bankDetails: BankDetails
  signupToken?: string
  viewToken?: string
  registrationId?: string
  authFetch?: (input: string, init?: RequestInit) => Promise<Response>
  onBankContinue: () => void
  checkoutCancelled?: boolean
  successPath?: string
}

const CHECKOUT_START_TIMEOUT_MS = 20_000

export const PaymentStep = ({
  registration,
  uniqueCode,
  showOnline,
  bankDetails,
  signupToken,
  viewToken,
  registrationId,
  authFetch,
  onBankContinue,
  checkoutCancelled = false,
  successPath,
}: PaymentStepProps) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(
    showOnline ? "online" : "bank"
  )
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false)
  const [checkoutError, setCheckoutError] = useState("")
  useBusyCursor(isLoadingCheckout)

  const outstanding = Math.max(
    0,
    Number(registration.amount_due) - Number(registration.amount_paid)
  )
  const paymentAmount =
    outstanding > 0 ? outstanding : Number(registration.amount_due)

  const handlePayOnline = async () => {
    if (outstanding <= 0 || isLoadingCheckout) return

    setCheckoutError("")
    setIsLoadingCheckout(true)
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), CHECKOUT_START_TIMEOUT_MS)
    try {
      const fetcher = authFetch ?? fetch
      const isGuest = Boolean(signupToken || viewToken)
      const res = await fetcher("/api/payments/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          attemptId: crypto.randomUUID(),
          signupToken: signupToken || undefined,
          viewToken: viewToken || undefined,
          registrationId: registrationId || undefined,
          successPath: successPath ?? (isGuest ? "/register/complete" : "/my-registration"),
          cancelPath: isGuest ? "/register/pay" : "/payment",
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) {
        setCheckoutError(data.error ?? "Could not start online payment. Please try again.")
        setIsLoadingCheckout(false)
        return
      }
      window.location.assign(data.url as string)
    } catch (err) {
      setCheckoutError(
        err instanceof DOMException && err.name === "AbortError"
          ? "Stripe is taking too long to respond. Please try again, or use bank transfer."
          : "Could not start online payment. Please try again."
      )
      setIsLoadingCheckout(false)
    } finally {
      window.clearTimeout(timeoutId)
    }
  }

  const handleBankContinue = async () => {
    try {
      const fetcher = authFetch ?? fetch
      await fetcher("/api/payments/bank-acknowledged", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signupToken: signupToken || undefined,
          viewToken: viewToken || undefined,
          registrationId: registrationId || undefined,
        }),
      })
    } catch {
      // non-blocking audit
    }
    onBankContinue()
  }

  return (
    <div className="space-y-6">
      {outstanding <= 0 ? (
        <Alert variant="success">This registration has no remaining balance.</Alert>
      ) : (
        <fieldset className="space-y-3" disabled={isLoadingCheckout}>
          <legend className="mb-3 text-base font-semibold text-ink">
            Choose how you would like to pay
          </legend>

          {checkoutCancelled ? (
            <Alert variant="warning">
              Online payment was cancelled and you have not been charged. You can try again or
              pay by bank transfer.
            </Alert>
          ) : null}

          {showOnline ? (
            <PaymentOption
              value="online"
              title="Online Payment"
              description="Card, Apple Pay, Link, Klarna or Zip"
              selectedMethod={selectedMethod}
              onSelect={setSelectedMethod}
            >
              <div className="space-y-4">
                <PaymentMethodBadges />
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
                  <li>
                    You will be redirected to <strong className="text-ink">Stripe</strong>, our
                    secure payment provider, to complete checkout.
                  </li>
                  <li>
                    After paying you will come straight back here and receive an email receipt.
                  </li>
                  <li>Your card details go directly to Stripe and are never stored by CFCA.</li>
                </ul>
                {checkoutError ? <Alert variant="error">{checkoutError}</Alert> : null}
                <Button
                  type="button"
                  onClick={() => void handlePayOnline()}
                  disabled={isLoadingCheckout}
                  isLoading={isLoadingCheckout}
                  loadingText="Redirecting to Stripe..."
                  className={cn("w-full sm:w-auto", isLoadingCheckout && "cursor-wait")}
                  aria-label={`Pay ${formatCurrency(outstanding)} online with Stripe`}
                >
                  Pay {formatCurrency(outstanding)} online
                </Button>
              </div>
            </PaymentOption>
          ) : null}

          <PaymentOption
            value="bank"
            title="Bank Payment"
            description="Transfer from your bank app using your Unique Code"
            selectedMethod={selectedMethod}
            onSelect={setSelectedMethod}
          >
            <div className="space-y-4">
              <BankTransferDetails bankDetails={bankDetails} />
              <Alert variant="info">
                <strong>IMPORTANT:</strong> Include your <strong>Unique Code</strong> in both
                Message and Ref. when paying via your bank app.
              </Alert>
              <PaymentReferenceMockup uniqueCode={uniqueCode} amount={paymentAmount} />
              <Button
                type="button"
                onClick={() => void handleBankContinue()}
                aria-label="Continue after noting bank transfer details"
              >
                I&apos;ve noted the bank details — continue
              </Button>
            </div>
          </PaymentOption>
        </fieldset>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your Registration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(registration.given_name || registration.surname) && (
            <p>
              <strong>Name:</strong> {registration.given_name} {registration.surname}
            </p>
          )}
          <p>
            <strong>Unique Code:</strong>{" "}
            <span className="font-bold text-[color:var(--danger)]">{uniqueCode}</span>
          </p>
          {registration.registration_no &&
            !String(registration.registration_no).startsWith("DRAFT") && (
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
            <span className={cn(outstanding > 0 && "font-semibold text-accent-ink")}>
              {formatCurrency(outstanding)}
            </span>
          </p>
          <p>
            <strong>Status:</strong> {registration.payment_status}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

type PaymentOptionProps = {
  value: PaymentMethod
  title: string
  description: string
  selectedMethod: PaymentMethod
  onSelect: (method: PaymentMethod) => void
  children: ReactNode
}

const PaymentOption = ({
  value,
  title,
  description,
  selectedMethod,
  onSelect,
  children,
}: PaymentOptionProps) => {
  const isSelected = selectedMethod === value
  const inputId = `payment-method-${value}`

  return (
    <div
      className={cn(
        "rounded-lg border bg-surface transition-colors",
        isSelected
          ? "border-brand ring-1 ring-brand"
          : "border-[color:var(--line-strong)] hover:border-brand-mid"
      )}
    >
      <label htmlFor={inputId} className="flex cursor-pointer items-start gap-3 px-4 py-4">
        <input
          id={inputId}
          type="radio"
          name="payment-method"
          value={value}
          checked={isSelected}
          onChange={() => onSelect(value)}
          className="mt-1 h-4 w-4 accent-brand"
          aria-controls={`${inputId}-panel`}
        />
        <span className="space-y-0.5">
          <span className="block font-semibold text-ink">{title}</span>
          <span className="block text-sm text-ink-soft">{description}</span>
        </span>
      </label>
      {isSelected ? (
        <div
          id={`${inputId}-panel`}
          className="border-t border-[color:var(--line)] px-4 py-4"
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}
