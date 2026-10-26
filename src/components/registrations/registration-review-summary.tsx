import {
  DEFAULT_PRICING_CONFIG,
  buildPricingBreakdown,
  formatCurrency,
  getAdultEarlyBirdSaving,
  resolveEarlyBirdSlot,
  type PricingConfig,
  type PricingLineItem,
} from "@/lib/pricing/calculate"
import { isEarlyBirdClaimOpen, type EarlyBirdSlot } from "@/lib/pricing/early-bird"
import { buildAttendeesForPricing } from "@/lib/registrations/service"
import type { RegistrationFormData } from "@/lib/registrations/schema"
import {
  formatSouvenirOrdersSummary,
  souvenirTotalAmount,
  souvenirTotalQuantity,
  TSHIRT_UNIT_PRICE,
} from "@/lib/registrations/souvenirs"
import { Alert } from "@/components/ui/alert"
import { PaymentReferenceMockup } from "@/components/registrations/payment-reference-mockup"
import { EarlyBirdReminders } from "@/components/registrations/early-bird-reminders"

import { PAYMENT_LABELS } from "@/lib/payments/labels"
import { UniqueCodeValue } from "@/components/payments/unique-code"

/** Early bird already held by a submitted registration that is being edited. */
export type StoredEarlyBird = {
  slot: EarlyBirdSlot
  earlyBirdAdults: number
}

type RegistrationReviewSummaryProps = {
  formData: RegistrationFormData
  participantReference: string | null
  pricingConfig?: PricingConfig
  souvenirPreorderEnabled?: boolean
  storedEarlyBird?: StoredEarlyBird | null
}

/**
 * Estimate only: the server also checks early bird places when the registration is saved.
 * While claiming is open every adult is shown on early bird. A submitted registration without early bird
 * does not gain it on edit; once claiming closes an edited registration keeps only the adults it already
 * had on early bird and anyone added pays the regular rate.
 */
const previewEarlyBird = (
  state: string | undefined,
  config: PricingConfig,
  stored?: StoredEarlyBird | null
): { slot: EarlyBirdSlot; adultLimit: number | null } => {
  if (stored?.slot === "none") return { slot: "none", adultLimit: null }
  if (isEarlyBirdClaimOpen(config)) {
    return { slot: resolveEarlyBirdSlot(state, new Date(), config), adultLimit: null }
  }
  if (!stored) return { slot: "none", adultLimit: null }
  return { slot: stored.slot, adultLimit: stored.earlyBirdAdults }
}

const buildAttendeeDescriptions = (data: RegistrationFormData) => {
  const descriptions = [
    `${data.given_name} ${data.surname}`.trim() || "Primary registrant",
  ]
  if (data.spouse_attending) {
    descriptions.push(
      `${data.spouse_given_name ?? ""} ${data.spouse_surname ?? ""}`.trim() || "Spouse"
    )
  }
  for (const attendee of data.attendees ?? []) {
    descriptions.push(`${attendee.given_name} ${attendee.surname} (age ${attendee.age})`)
  }
  return descriptions
}

const PricingTable = ({ lineItems, total, totalEarlyBirdSaving, totalLabel }: {
  lineItems: PricingLineItem[]
  total: number
  totalEarlyBirdSaving: number
  totalLabel: string
}) => (
  <div className="overflow-x-auto rounded-md border">
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b bg-gray-50">
          <th className="p-3 font-medium">Attendee</th>
          <th className="p-3 font-medium">Rate</th>
          <th className="p-3 font-medium text-right">Early bird</th>
          <th className="p-3 font-medium text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        {lineItems.map((item, index) => (
          <tr key={`${item.description}-${index}`} className="border-b last:border-b-0">
            <td className="p-3">
              <div className="font-medium">{item.description}</div>
              {item.note && <div className="text-xs text-gray-500">{item.note}</div>}
            </td>
            <td className="p-3">
              {item.standardAmount !== undefined ? (
                <span className="text-gray-500 line-through">{formatCurrency(item.standardAmount)}</span>
              ) : (
                formatCurrency(item.amount)
              )}
            </td>
            <td className="p-3 text-right text-green-700">
              {item.earlyBirdSaving ? `−${formatCurrency(item.earlyBirdSaving)}` : "—"}
            </td>
            <td className="p-3 text-right font-medium">{formatCurrency(item.amount)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        {totalEarlyBirdSaving > 0 && (
          <tr className="border-t bg-green-50">
            <td colSpan={3} className="p-3 text-right font-medium text-green-800">
              Total early bird savings
            </td>
            <td className="p-3 text-right font-medium text-green-800">
              −{formatCurrency(totalEarlyBirdSaving)}
            </td>
          </tr>
        )}
        <tr className="border-t bg-gray-50">
          <td colSpan={3} className="p-3 text-right text-base font-bold">
            {totalLabel}
          </td>
          <td className="p-3 text-right text-base font-bold">{formatCurrency(total)}</td>
        </tr>
      </tfoot>
    </table>
  </div>
)

export const RegistrationReviewSummary = ({
  formData,
  participantReference,
  pricingConfig = DEFAULT_PRICING_CONFIG,
  souvenirPreorderEnabled = true,
  storedEarlyBird = null,
}: RegistrationReviewSummaryProps) => {
  const attendees = buildAttendeesForPricing(formData)
  const { slot: earlyBirdSlot, adultLimit } = previewEarlyBird(
    formData.state ?? undefined,
    pricingConfig,
    storedEarlyBird
  )
  const lineItems = buildPricingBreakdown(
    attendees,
    earlyBirdSlot,
    buildAttendeeDescriptions(formData),
    pricingConfig,
    adultLimit
  )
  const total = lineItems.reduce((sum, item) => sum + item.amount, 0)
  const souvenirAmount = souvenirTotalAmount(formData.souvenir_orders)
  const souvenirQty = souvenirTotalQuantity(formData.souvenir_orders)
  const grandTotal = total + souvenirAmount
  const totalEarlyBirdSaving = lineItems.reduce(
    (sum, item) => sum + (item.earlyBirdSaving ?? 0),
    0
  )
  const attendeeCount = attendees.length

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Please review your details and estimated cost before submitting.
      </p>

      <dl className="grid gap-2 text-sm md:grid-cols-2">
        <div>
          <dt className="font-medium">Name</dt>
          <dd>{formData.given_name} {formData.surname}</dd>
        </div>
        <div>
          <dt className="font-medium">Email</dt>
          <dd>{formData.email}</dd>
        </div>
        <div className="md:col-span-2">
          <dt className="font-medium">Food allergy &amp; dietary requirements</dt>
          <dd>{formData.dietary_requirements?.trim() || "None specified"}</dd>
        </div>
        <div>
          <dt className="font-medium">CFCA Membership State</dt>
          <dd>{formData.state}</dd>
        </div>
        <div>
          <dt className="font-medium">Attendees</dt>
          <dd>{attendeeCount}</dd>
        </div>
        {(souvenirPreorderEnabled || souvenirQty > 0) && (
          <div className="md:col-span-2">
            <dt className="font-medium">Souvenir t-shirts</dt>
            <dd>
              {souvenirQty > 0
                ? `${formatSouvenirOrdersSummary(formData.souvenir_orders)} (${formatCurrency(souvenirAmount)})`
                : "None"}
            </dd>
          </div>
        )}
        {formData.transport_option && formData.transport_option !== "own" && (
          <>
            <div>
              <dt className="font-medium">Hotel / accommodation name</dt>
              <dd>{formData.hotel_name?.trim() || "Not provided"}</dd>
            </div>
            <div>
              <dt className="font-medium">Hotel / accommodation address</dt>
              <dd>{formData.hotel_address?.trim() || "Not provided"}</dd>
            </div>
          </>
        )}
        {participantReference && (
          <div className="md:col-span-2">
            <dt className="font-medium">Your Unique Code</dt>
            <dd className="mt-1">
              <UniqueCodeValue code={participantReference} />
            </dd>
          </div>
        )}
      </dl>

      <div className="space-y-2">
        <h3 className="font-semibold">Registration cost</h3>
        {earlyBirdSlot !== "none" && (
          <>
            <Alert variant="success">
              Early bird pricing — {formatCurrency(pricingConfig.adultEarlyBird)} per adult (save{" "}
              {formatCurrency(getAdultEarlyBirdSaving(pricingConfig))} per adult), subject to
              available places.
            </Alert>
            <EarlyBirdReminders pricing={pricingConfig} />
          </>
        )}
        <PricingTable
          lineItems={lineItems}
          total={total}
          totalEarlyBirdSaving={totalEarlyBirdSaving}
          totalLabel={souvenirQty > 0 ? "Attendee fees" : PAYMENT_LABELS.fee}
        />
        {souvenirQty > 0 && (
          <div className="rounded-md border p-3 text-sm">
            <div className="flex justify-between gap-4">
              <span>
                Love In Action t-shirts ({souvenirQty} × {formatCurrency(TSHIRT_UNIT_PRICE)})
              </span>
              <span className="font-medium">{formatCurrency(souvenirAmount)}</span>
            </div>
            <div className="mt-2 flex justify-between gap-4 border-t pt-2 text-base font-bold">
              <span>{PAYMENT_LABELS.fee}</span>
              <span>{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        )}
      </div>

      {participantReference && (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Please make sure to add{" "}
            <span className="font-bold text-red-600">{participantReference}</span>{" "}
            in both the <strong>Message</strong> and <strong>Ref.</strong> fields when making payment.
          </p>

          <Alert variant="info">
            <strong>IMPORTANT:</strong> Please include your{" "}
            <strong>Unique Code</strong> in both Message and Ref. This ensures your payment is
            matched with your registration.
          </Alert>

          <PaymentReferenceMockup uniqueCode={participantReference} amount={grandTotal} />
        </div>
      )}
    </div>
  )
}
