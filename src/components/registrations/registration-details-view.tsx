"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { BedDouble, Clock, Landmark, Lock, Users, type LucideIcon } from "lucide-react"
import { useBusyCursor } from "@/hooks/use-busy-cursor"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PaymentSummary } from "@/components/payments/payment-summary"
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge"
import { UniqueCode } from "@/components/payments/unique-code"
import { NeedHelpCard, SupportLink } from "@/components/support/support-links"
import { balanceDue } from "@/lib/payments/labels"
import { formatCurrency, type PricingConfig } from "@/lib/pricing/calculate"
import { showsEarlyBirdReminders } from "@/lib/pricing/early-bird"
import { EarlyBirdReminders } from "@/components/registrations/early-bird-reminders"
import { CFCA_POSITION_LABELS, MINISTRY_LABELS } from "@/lib/registrations/schema"
import {
  getAccommodationLabel,
  getTransportOptionLabel,
  booleansToTransportOption,
} from "@/lib/registrations/transport"
import { formatSouvenirOrdersSummary, hasSouvenirPreOrder } from "@/lib/registrations/souvenirs"

export type RegistrationDetails = {
  registration_no: string
  participant_reference: string | null
  surname: string
  given_name: string
  email: string
  mobile: string
  state: string | null
  cfca_position: string | null
  ministry?: string | null
  elder_assembly_attending?: boolean | null
  dietary_requirements?: string | null
  address_line1?: string | null
  address_line2?: string | null
  suburb?: string | null
  address_state?: string | null
  postcode?: string | null
  spouse_attending: boolean
  spouse_surname?: string | null
  spouse_given_name?: string | null
  spouse_email?: string | null
  spouse_mobile?: string | null
  spouse_dietary_requirements?: string | null
  payment_status: string
  amount_due: number
  amount_paid: number
  submitted_at: string | null
  accommodation_type: string | null
  pickup_melbourne_airport: boolean
  dropoff_melbourne_airport: boolean
  arrival_date?: string | null
  arrival_airport?: string | null
  arrival_flight_no?: string | null
  departure_date?: string | null
  departure_airport?: string | null
  departure_flight_no?: string | null
  hotel_name?: string | null
  hotel_address?: string | null
  accommodation_contact_name?: string | null
  accommodation_contact_phone?: string | null
  pickup_transport_contact_name?: string | null
  pickup_transport_contact_phone?: string | null
  dropoff_transport_contact_name?: string | null
  dropoff_transport_contact_phone?: string | null
  souvenir_orders?: unknown
  is_early_bird?: boolean | null
  early_bird_slot?: string | null
  early_bird_adult_limit?: number | null
  registration_attendees?: {
    given_name: string
    surname: string
    age: number
    needs_kids_supervision?: boolean
    dietary_requirements?: string | null
  }[]
}

const hasText = (value?: string | null) => Boolean(value && value.trim())

const formatContact = (name?: string | null, phone?: string | null) =>
  `${name || "—"}${hasText(phone) ? ` (${phone})` : ""}`

const DetailList = ({ children }: { children: ReactNode }) => (
  <dl className="space-y-3">{children}</dl>
)

const DetailRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid gap-0.5 sm:grid-cols-[minmax(8rem,36%)_1fr] sm:gap-4">
    <dt className="text-sm font-medium text-[#64748B]">{label}</dt>
    <dd className="break-words text-[15px] text-[#172033] sm:text-base">{children}</dd>
  </div>
)

const IconCardHeader = ({ icon: Icon, title }: { icon: LucideIcon; title: string }) => (
  <CardHeader className="flex flex-row items-center gap-3 space-y-0 border-b border-[#E2E8F0] py-4">
    <Icon className="h-5 w-5 shrink-0 text-[#1E5AA8]" aria-hidden="true" />
    <CardTitle className="font-sans text-base font-semibold text-[#172033]">{title}</CardTitle>
  </CardHeader>
)

type PayBalanceActionsProps = {
  amount: number
  payHref: string
  onlineEnabled: boolean
}

const PayBalanceActions = ({ amount, payHref, onlineEnabled }: PayBalanceActionsProps) => {
  const router = useRouter()
  const [isNavigating, setIsNavigating] = useState(false)
  useBusyCursor(isNavigating)
  const amountLabel = formatCurrency(amount)

  const handlePayClick = () => {
    if (isNavigating) return
    setIsNavigating(true)
    router.push(payHref)
  }

  return (
    <>
      <p className="text-sm text-[#64748B]">
        Your registration is reserved. Complete payment to confirm your attendance.
      </p>
      <Button
        type="button"
        size="lg"
        className="w-full bg-[#1E5AA8] px-4 hover:bg-[#173F7A]"
        onClick={handlePayClick}
        isLoading={isNavigating}
        loadingText="Opening payment..."
        aria-label={
          onlineEnabled
            ? `Pay balance due of ${amountLabel} securely`
            : `View bank transfer details to pay ${amountLabel}`
        }
      >
        {onlineEnabled ? (
          <>
            <Lock className="h-4 w-4" aria-hidden="true" />
            Pay {amountLabel} securely
          </>
        ) : (
          <>
            <Landmark className="h-4 w-4" aria-hidden="true" />
            View bank transfer details
          </>
        )}
      </Button>
      <p className="flex items-center gap-1.5 text-xs text-[#64748B]">
        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {onlineEnabled
          ? "Secure payment · Confirmation emailed after payment"
          : "Confirmation emailed once your payment is received"}
      </p>
    </>
  )
}

type RegistrationDetailsViewProps = {
  registration: RegistrationDetails
  payHref: string
  onlineEnabled: boolean
  /** Runtime pricing settings; enables the early bird reminders. */
  pricing?: PricingConfig | null
  /** Shown between the main card and the attendee / accommodation cards. */
  notice?: ReactNode
  actions?: ReactNode
}

export const RegistrationDetailsView = ({
  registration,
  payHref,
  onlineEnabled,
  pricing,
  notice,
  actions,
}: RegistrationDetailsViewProps) => {
  const transport = booleansToTransportOption(
    registration.pickup_melbourne_airport,
    registration.dropoff_melbourne_airport
  )
  const paymentRef = registration.participant_reference || registration.registration_no
  const remainingBalance = balanceDue(registration.amount_due, registration.amount_paid)
  const canPay = !!registration.submitted_at && remainingBalance > 0
  const earlyBirdPricing =
    canPay && pricing && showsEarlyBirdReminders(registration, pricing) ? pricing : null
  const address = [
    registration.address_line1,
    registration.address_line2,
    registration.suburb,
    registration.address_state,
    registration.postcode,
  ]
    .filter(Boolean)
    .join(", ")
  const attendees = registration.registration_attendees ?? []
  const hasAccommodationContact =
    hasText(registration.accommodation_contact_name) ||
    hasText(registration.accommodation_contact_phone)
  const hasPickupContact =
    hasText(registration.pickup_transport_contact_name) ||
    hasText(registration.pickup_transport_contact_phone)
  const hasDropoffContact =
    hasText(registration.dropoff_transport_contact_name) ||
    hasText(registration.dropoff_transport_contact_phone)
  const supportRef = {
    registrationNo: registration.registration_no,
    uniqueCode: registration.participant_reference,
    name: `${registration.given_name} ${registration.surname}`,
  }

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E2E8F0] px-5 py-5 sm:px-6 sm:py-6">
          <div className="space-y-1">
            <h1 className="font-sans text-2xl font-semibold tracking-tight text-[#172033] sm:text-[1.75rem]">
              Registration details
            </h1>
            <p className="text-sm text-[#64748B] sm:text-base">
              {canPay
                ? "Review your registration and complete payment to confirm your attendance."
                : "Review your registration details."}
            </p>
          </div>
          {registration.payment_status === "pending" ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#FEF3C7] px-3 py-1 text-sm font-semibold text-[#92400E]">
              <Clock className="h-4 w-4" aria-hidden="true" />
              Payment pending
            </span>
          ) : (
            <PaymentStatusBadge status={registration.payment_status} className="px-3 py-1 text-sm" />
          )}
        </div>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
          <div className="space-y-6 px-5 py-6 sm:px-6 lg:border-r lg:border-[#E2E8F0]">
            <div className="space-y-4">
              <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                Registration information
              </h2>
              <DetailList>
                <DetailRow label="Registration No">{registration.registration_no}</DetailRow>
                <DetailRow label="Name">
                  {registration.given_name} {registration.surname}
                </DetailRow>
                <DetailRow label="Email">{registration.email}</DetailRow>
                <DetailRow label="Mobile">{registration.mobile}</DetailRow>
                <DetailRow label="Conference State">{registration.state ?? "—"}</DetailRow>
                <DetailRow label="Ministry">
                  {registration.ministry
                    ? MINISTRY_LABELS[registration.ministry as keyof typeof MINISTRY_LABELS] ??
                      registration.ministry
                    : "—"}
                </DetailRow>
                <DetailRow label="Ministry Role">
                  {registration.cfca_position
                    ? CFCA_POSITION_LABELS[
                        registration.cfca_position as keyof typeof CFCA_POSITION_LABELS
                      ] ?? registration.cfca_position
                    : "—"}
                </DetailRow>
                {registration.elder_assembly_attending && (
                  <DetailRow label="Elder's assembly">Attending</DetailRow>
                )}
                <DetailRow label="Address">{address || "—"}</DetailRow>
                <DetailRow label="Spouse attending">
                  {registration.spouse_attending ? "Yes" : "No"}
                </DetailRow>
                {registration.spouse_attending && (
                  <>
                    <DetailRow label="Spouse name">
                      {[registration.spouse_given_name, registration.spouse_surname]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </DetailRow>
                    {registration.spouse_email && (
                      <DetailRow label="Spouse email">{registration.spouse_email}</DetailRow>
                    )}
                    {registration.spouse_mobile && (
                      <DetailRow label="Spouse mobile">{registration.spouse_mobile}</DetailRow>
                    )}
                    <DetailRow label="Spouse dietary requirements">
                      {registration.spouse_dietary_requirements?.trim() || "None specified"}
                    </DetailRow>
                  </>
                )}
                <DetailRow label="Dietary requirements">
                  {registration.dietary_requirements?.trim() || "None specified"}
                </DetailRow>
              </DetailList>
            </div>
            <div className="border-t border-[#E2E8F0] pt-6">
              <UniqueCode code={paymentRef} />
            </div>
          </div>
          <div className="space-y-4 p-4 sm:p-6">
            <PaymentSummary
              amountDue={registration.amount_due}
              amountPaid={registration.amount_paid}
              status={registration.payment_status}
              showStatus={false}
            >
              {earlyBirdPricing ? <EarlyBirdReminders pricing={earlyBirdPricing} /> : null}
              {canPay ? (
                <PayBalanceActions
                  amount={remainingBalance}
                  payHref={payHref}
                  onlineEnabled={onlineEnabled}
                />
              ) : null}
              <SupportLink topic="payment" registration={supportRef} />
            </PaymentSummary>
            <NeedHelpCard registration={supportRef} />
          </div>
        </div>
      </Card>

      {notice}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <IconCardHeader icon={Users} title="Other people attending" />
          <CardContent className="pt-5">
            {attendees.length > 0 ? (
              <ul className="space-y-3">
                {attendees.map((a, i) => (
                  <li key={i} className="text-[15px] text-[#172033] sm:text-base">
                    {a.given_name} {a.surname}
                    <span className="block text-sm text-[#64748B]">
                      Age {a.age}
                      {a.needs_kids_supervision ? " · Kids supervision" : ""}
                      {a.dietary_requirements?.trim()
                        ? ` · Dietary: ${a.dietary_requirements.trim()}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#64748B]">No additional attendees</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <IconCardHeader icon={BedDouble} title="Accommodation & transport" />
          <CardContent className="space-y-4 pt-5">
            <DetailList>
              <DetailRow label="Accommodation">
                {getAccommodationLabel(registration.accommodation_type) || "—"}
              </DetailRow>
              <DetailRow label="Transport">{getTransportOptionLabel(transport)}</DetailRow>
              {(hasText(registration.hotel_name) || hasText(registration.hotel_address)) && (
                <>
                  <DetailRow label="Hotel name">{registration.hotel_name || "—"}</DetailRow>
                  <DetailRow label="Hotel address">{registration.hotel_address || "—"}</DetailRow>
                </>
              )}
              {hasAccommodationContact && (
                <DetailRow label="Accommodation contact">
                  {formatContact(
                    registration.accommodation_contact_name,
                    registration.accommodation_contact_phone
                  )}
                </DetailRow>
              )}
              {registration.pickup_melbourne_airport && (
                <DetailRow label="Arrival">
                  {registration.arrival_date || "—"} / {registration.arrival_airport || "—"} /{" "}
                  {registration.arrival_flight_no || "—"}
                </DetailRow>
              )}
              {registration.pickup_melbourne_airport && hasPickupContact && (
                <DetailRow label="Pickup contact">
                  {formatContact(
                    registration.pickup_transport_contact_name,
                    registration.pickup_transport_contact_phone
                  )}
                </DetailRow>
              )}
              {registration.dropoff_melbourne_airport && (
                <DetailRow label="Departure">
                  {registration.departure_date || "—"} / {registration.departure_airport || "—"}{" "}
                  / {registration.departure_flight_no || "—"}
                </DetailRow>
              )}
              {registration.dropoff_melbourne_airport && hasDropoffContact && (
                <DetailRow label="Drop-off contact">
                  {formatContact(
                    registration.dropoff_transport_contact_name,
                    registration.dropoff_transport_contact_phone
                  )}
                </DetailRow>
              )}
            </DetailList>
            <SupportLink topic="accommodation" registration={supportRef} />
          </CardContent>
        </Card>
      </div>

      {hasSouvenirPreOrder(registration.souvenir_orders) && (
        <Card>
          <CardHeader>
            <CardTitle className="font-sans text-lg">Souvenirs</CardTitle>
          </CardHeader>
          <CardContent className="text-[15px] text-[#172033] sm:text-base">
            {formatSouvenirOrdersSummary(registration.souvenir_orders)}
          </CardContent>
        </Card>
      )}

      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </>
  )
}
