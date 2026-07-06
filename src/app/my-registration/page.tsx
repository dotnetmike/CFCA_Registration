"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/auth/context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/pricing/calculate"
import { CFCA_POSITION_LABELS } from "@/lib/registrations/schema"
import { getAccommodationLabel, getTransportOptionLabel, booleansToTransportOption } from "@/lib/registrations/transport"

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
  spouse_attending: boolean
  payment_status: string
  amount_due: number
  amount_paid: number
  submitted_at: string | null
  accommodation_type: string | null
  pickup_melbourne_airport: boolean
  dropoff_melbourne_airport: boolean
  registration_attendees: { given_name: string; surname: string; age: number }[]
}

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
        <Link href="/register" className="text-blue-600 underline">Start registration</Link>
      </Alert>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Registration</h1>
        <Link href="/register">
          <Button variant="outline" aria-label="Edit registration">Edit</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registration Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-2">
          <div><strong>Name:</strong> {registration.given_name} {registration.surname}</div>
          <div><strong>Email:</strong> {registration.email}</div>
          <div><strong>Mobile:</strong> {registration.mobile}</div>
          <div><strong>State:</strong> {registration.state}</div>
          {registration.participant_reference && (
            <div className="md:col-span-2">
              <strong>Payment Reference:</strong>{" "}
              <span className="font-bold text-red-600">{registration.participant_reference}</span>
            </div>
          )}
          <div>
            <strong>Position:</strong>{" "}
            {registration.cfca_position
              ? CFCA_POSITION_LABELS[registration.cfca_position as keyof typeof CFCA_POSITION_LABELS]
              : "—"}
          </div>
          <div><strong>Spouse Attending:</strong> {registration.spouse_attending ? "Yes" : "No"}</div>
          <div><strong>Payment Status:</strong> {registration.payment_status}</div>
          <div><strong>Amount Due:</strong> {formatCurrency(Number(registration.amount_due))}</div>
          <div><strong>Amount Paid:</strong> {formatCurrency(Number(registration.amount_paid))}</div>
          {registration.accommodation_type && (
            <div>
              <strong>Accommodation:</strong> {getAccommodationLabel(registration.accommodation_type)}
            </div>
          )}
          {(() => {
            const transport = booleansToTransportOption(
              registration.pickup_melbourne_airport,
              registration.dropoff_melbourne_airport
            )
            if (!transport) return null
            return (
              <div className="md:col-span-2">
                <strong>Transport:</strong> {getTransportOptionLabel(transport)}
              </div>
            )
          })()}
        </CardContent>
      </Card>

      {registration.registration_attendees?.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Additional Attendees</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {registration.registration_attendees.map((a, i) => (
                <li key={i}>{a.given_name} {a.surname} (age {a.age})</li>
              ))}
            </ul>
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
