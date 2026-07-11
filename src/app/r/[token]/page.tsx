"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
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

type RegistrationView = {
  id: string
  registration_no: string
  participant_reference: string | null
  surname: string
  given_name: string
  email: string
  mobile: string
  state: string | null
  cfca_position: string | null
  address_line1?: string
  suburb?: string
  address_state?: string | null
  postcode?: string
  spouse_attending: boolean
  spouse_surname?: string
  spouse_given_name?: string
  spouse_email?: string
  spouse_mobile?: string
  payment_status: string
  amount_due: number
  amount_paid: number
  submitted_at: string | null
  accommodation_type: string | null
  pickup_melbourne_airport: boolean
  dropoff_melbourne_airport: boolean
  arrival_date?: string | null
  arrival_airport?: string
  arrival_flight_no?: string
  departure_date?: string | null
  departure_airport?: string
  departure_flight_no?: string
  registration_attendees?: {
    given_name: string
    surname: string
    age: number
    needs_kids_supervision?: boolean
  }[]
  user_id?: string | null
}

const MagicRegistrationPage = () => {
  const params = useParams<{ token: string }>()
  const token = params.token
  const [registration, setRegistration] = useState<RegistrationView | null>(null)
  const [hasAccount, setHasAccount] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!token) return

    const load = async () => {
      const res = await fetch(`/api/registrations/view/${encodeURIComponent(token)}`)
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
  }, [token])

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

  const transport = booleansToTransportOption(
    registration.pickup_melbourne_airport,
    registration.dropoff_melbourne_airport
  )
  const paymentRef = registration.participant_reference || registration.registration_no
  const editHref = hasAccount
    ? `/login?redirect=${encodeURIComponent("/register")}`
    : `/signup?email=${encodeURIComponent(registration.email)}&redirect=${encodeURIComponent("/register")}`

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Registration Details</h1>
        <Link href={editHref}>
          <Button variant="outline" aria-label="Edit registration">
            Edit registration
          </Button>
        </Link>
      </div>

      <Alert variant="info">
        You are viewing this registration via a secure email link. To make changes,{" "}
        {hasAccount ? "log in" : "create an account"} first.
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Personal</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
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
            <strong>State:</strong> {registration.state ?? "—"}
          </div>
          <div>
            <strong>Position:</strong>{" "}
            {registration.cfca_position
              ? CFCA_POSITION_LABELS[
                  registration.cfca_position as keyof typeof CFCA_POSITION_LABELS
                ]
              : "—"}
          </div>
          <div>
            <strong>Registration No:</strong> {registration.registration_no}
          </div>
          <div className="md:col-span-2">
            <strong>Payment Reference:</strong>{" "}
            <span className="font-bold text-red-600">{paymentRef}</span>
          </div>
          {(registration.address_line1 || registration.suburb) && (
            <div className="md:col-span-2">
              <strong>Address:</strong>{" "}
              {[
                registration.address_line1,
                registration.suburb,
                registration.address_state,
                registration.postcode,
              ]
                .filter(Boolean)
                .join(", ")}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spouse &amp; Attendees</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <strong>Spouse attending:</strong> {registration.spouse_attending ? "Yes" : "No"}
          </p>
          {registration.spouse_attending && (
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                {registration.spouse_given_name} {registration.spouse_surname}
              </div>
              <div>{registration.spouse_email}</div>
              <div>{registration.spouse_mobile}</div>
            </div>
          )}
          {registration.registration_attendees && registration.registration_attendees.length > 0 ? (
            <ul className="space-y-1">
              {registration.registration_attendees.map((a, i) => (
                <li key={i}>
                  {a.given_name} {a.surname} (age {a.age})
                  {a.needs_kids_supervision ? " — kids supervision" : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">No additional attendees</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accommodation &amp; Transport</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>Accommodation:</strong>{" "}
            {getAccommodationLabel(registration.accommodation_type) || "—"}
          </p>
          <p>
            <strong>Transport:</strong> {getTransportOptionLabel(transport)}
          </p>
          {registration.pickup_melbourne_airport && (
            <p>
              Arrival: {registration.arrival_date || "—"} / {registration.arrival_airport || "—"} /{" "}
              {registration.arrival_flight_no || "—"}
            </p>
          )}
          {registration.dropoff_melbourne_airport && (
            <p>
              Departure: {registration.departure_date || "—"} /{" "}
              {registration.departure_airport || "—"} / {registration.departure_flight_no || "—"}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-2">
          <div>
            <strong>Amount Due:</strong> {formatCurrency(Number(registration.amount_due))}
          </div>
          <div>
            <strong>Amount Paid:</strong> {formatCurrency(Number(registration.amount_paid))}
          </div>
          <div>
            <strong>Status:</strong> {registration.payment_status}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Link href={editHref}>
          <Button aria-label="Create account or login to edit">
            {hasAccount ? "Log in to edit" : "Create account to edit"}
          </Button>
        </Link>
        <Link href="/">
          <Button variant="outline">Home</Button>
        </Link>
      </div>
    </div>
  )
}

export default MagicRegistrationPage
