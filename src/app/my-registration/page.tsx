"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/auth/context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/pricing/calculate"
import { CFCA_POSITION_LABELS } from "@/lib/registrations/schema"
import {
  getAccommodationLabel,
  getTransportOptionLabel,
  booleansToTransportOption,
} from "@/lib/registrations/transport"
import { formatSouvenirOrdersSummary, hasSouvenirPreOrder } from "@/lib/registrations/souvenirs"

type Registration = {
  id: string
  registration_no: string
  participant_reference: string | null
  surname: string
  given_name: string
  email: string
  mobile: string
  state: string
  cfca_position: string
  dietary_requirements?: string | null
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
  registration_attendees: {
    given_name: string
    surname: string
    age: number
    needs_kids_supervision?: boolean
    dietary_requirements?: string | null
  }[]
}

const hasText = (value?: string | null) => Boolean(value && value.trim())

const MyRegistrationPage = () => {
  const { authFetch } = useAuth()
  const [registration, setRegistration] = useState<Registration | null>(null)
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

  const transport = booleansToTransportOption(
    registration.pickup_melbourne_airport,
    registration.dropoff_melbourne_airport
  )
  const remaining = Math.max(
    0,
    Number(registration.amount_due) - Number(registration.amount_paid)
  )
  const showAccommodationDetails =
    hasText(registration.hotel_name) ||
    hasText(registration.hotel_address) ||
    hasText(registration.accommodation_contact_name) ||
    hasText(registration.accommodation_contact_phone)
  const showTransportSection =
    Boolean(transport) ||
    registration.pickup_melbourne_airport ||
    registration.dropoff_melbourne_airport

  return (
    <div className="cfca-page mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-ink">
            Your record
          </p>
          <h1 className="font-display text-4xl font-semibold text-ink">My Registration</h1>
        </div>
        <Link href="/">
          <Button variant="outline" aria-label="Edit registration">
            Edit
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registration Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-2">
          <div>
            <strong>Name:</strong> {registration.given_name} {registration.surname}
          </div>
          <div>
            <strong>Email:</strong> {registration.email}
          </div>
          <div>
            <strong>Mobile:</strong> {registration.mobile}
          </div>
          <div>
            <strong>State:</strong> {registration.state}
          </div>
          {registration.participant_reference && (
            <div className="md:col-span-2">
              <strong>Unique Code:</strong>{" "}
              <span className="font-bold text-[color:var(--danger)]">
                {registration.participant_reference}
              </span>
            </div>
          )}
          <div>
            <strong>Position:</strong>{" "}
            {registration.cfca_position
              ? CFCA_POSITION_LABELS[
                  registration.cfca_position as keyof typeof CFCA_POSITION_LABELS
                ]
              : "—"}
          </div>
          <div>
            <strong>Spouse Attending:</strong>{" "}
            {registration.spouse_attending ? "Yes" : "No"}
          </div>
          {registration.spouse_attending && (
            <>
              <div>
                <strong>Spouse Name:</strong>{" "}
                {[registration.spouse_given_name, registration.spouse_surname]
                  .filter(Boolean)
                  .join(" ") || "—"}
              </div>
              <div>
                <strong>Spouse Email:</strong> {registration.spouse_email || "—"}
              </div>
              <div>
                <strong>Spouse Mobile:</strong> {registration.spouse_mobile || "—"}
              </div>
              <div className="md:col-span-2">
                <strong>Spouse dietary requirements:</strong>{" "}
                {registration.spouse_dietary_requirements?.trim() || "None specified"}
              </div>
            </>
          )}
          <div className="md:col-span-2">
            <strong>Dietary requirements:</strong>{" "}
            {registration.dietary_requirements?.trim() || "None specified"}
          </div>
          <div>
            <strong>Payment Status:</strong> {registration.payment_status}
          </div>
          <div>
            <strong>Amount Due:</strong> {formatCurrency(Number(registration.amount_due))}
          </div>
          <div>
            <strong>Amount Paid:</strong> {formatCurrency(Number(registration.amount_paid))}
          </div>
          <div>
            <strong>Remaining balance:</strong> {formatCurrency(remaining)}
          </div>
        </CardContent>
      </Card>

      {(registration.accommodation_type || showAccommodationDetails || showTransportSection) && (
        <Card>
          <CardHeader>
            <CardTitle>Accommodation &amp; Transport</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {registration.accommodation_type && (
              <p>
                <strong>Accommodation:</strong>{" "}
                {getAccommodationLabel(registration.accommodation_type)}
              </p>
            )}
            {hasText(registration.hotel_name) && (
              <p>
                <strong>Accommodation name:</strong> {registration.hotel_name}
              </p>
            )}
            {hasText(registration.hotel_address) && (
              <p>
                <strong>Accommodation address:</strong> {registration.hotel_address}
              </p>
            )}
            {(hasText(registration.accommodation_contact_name) ||
              hasText(registration.accommodation_contact_phone)) && (
              <p>
                <strong>Accommodation contact:</strong>{" "}
                {registration.accommodation_contact_name || "—"}
                {hasText(registration.accommodation_contact_phone)
                  ? ` (${registration.accommodation_contact_phone})`
                  : ""}
              </p>
            )}
            {transport && (
              <p>
                <strong>Transport:</strong> {getTransportOptionLabel(transport)}
              </p>
            )}
            {registration.pickup_melbourne_airport && (
              <div className="space-y-1">
                <p>
                  <strong>Arrival:</strong> {registration.arrival_date || "—"} /{" "}
                  {registration.arrival_airport || "—"} /{" "}
                  {registration.arrival_flight_no || "—"}
                </p>
                {(hasText(registration.pickup_transport_contact_name) ||
                  hasText(registration.pickup_transport_contact_phone)) && (
                  <p>
                    <strong>Pickup contact:</strong>{" "}
                    {registration.pickup_transport_contact_name || "—"}
                    {hasText(registration.pickup_transport_contact_phone)
                      ? ` (${registration.pickup_transport_contact_phone})`
                      : ""}
                  </p>
                )}
              </div>
            )}
            {registration.dropoff_melbourne_airport && (
              <div className="space-y-1">
                <p>
                  <strong>Departure:</strong> {registration.departure_date || "—"} /{" "}
                  {registration.departure_airport || "—"} /{" "}
                  {registration.departure_flight_no || "—"}
                </p>
                {(hasText(registration.dropoff_transport_contact_name) ||
                  hasText(registration.dropoff_transport_contact_phone)) && (
                  <p>
                    <strong>Drop-off contact:</strong>{" "}
                    {registration.dropoff_transport_contact_name || "—"}
                    {hasText(registration.dropoff_transport_contact_phone)
                      ? ` (${registration.dropoff_transport_contact_phone})`
                      : ""}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {registration.registration_attendees?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Additional Attendees</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {registration.registration_attendees.map((a, i) => (
                <li key={i}>
                  {a.given_name} {a.surname} (age {a.age})
                  {a.needs_kids_supervision ? " — kids supervision required" : ""}
                  {a.dietary_requirements?.trim()
                    ? ` — Dietary requirements: ${a.dietary_requirements}`
                    : ""}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {hasSouvenirPreOrder(registration.souvenir_orders) && (
        <Card>
          <CardHeader>
            <CardTitle>Souvenirs</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {formatSouvenirOrdersSummary(registration.souvenir_orders)}
          </CardContent>
        </Card>
      )}

      {registration.submitted_at && (
        <Link href="/payment">
          <Button aria-label="View payment details">View Payment Details</Button>
        </Link>
      )}
    </div>
  )
}

export default MyRegistrationPage
