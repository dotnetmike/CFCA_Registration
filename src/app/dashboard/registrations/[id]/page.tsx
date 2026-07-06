"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth/context"
import { isManager } from "@/lib/auth/permissions-client"
import { useBusyCursor } from "@/hooks/use-busy-cursor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert } from "@/components/ui/alert"

const RegistrationDetailPage = () => {
  const params = useParams()
  const id = params.id as string
  const { user, authFetch } = useAuth()
  const router = useRouter()
  const [registration, setRegistration] = useState<Record<string, unknown> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  useBusyCursor(isSaving)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const canEditRegistration = user?.permissions.includes("registrations:write_all")
  const canEditAccommodation = user?.permissions.includes("accommodation:write_all")

  useEffect(() => {
    if (!user) return
    if (!isManager(user)) {
      router.push("/")
      return
    }

    const load = async () => {
      const res = await authFetch(`/api/registrations/${id}`)
      if (res.ok) {
        const data = await res.json()
        setRegistration(data.registration)
      }
      setIsLoading(false)
    }
    load()
  }, [user, authFetch, id, router])

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!registration) return
    setError("")
    setSuccess("")
    setIsSaving(true)

    const formData = new FormData(e.currentTarget)
    const payload: Record<string, unknown> = {}

    for (const [key, value] of formData.entries()) {
      if (key.startsWith("cb_")) {
        payload[key.replace("cb_", "")] = true
      } else if (value === "on") {
        payload[key] = true
      } else {
        payload[key] = value
      }
    }

    const checkboxes = ["spouse_attending", "pickup_melbourne_airport", "dropoff_melbourne_airport", "hotel_transport_required"]
    for (const cb of checkboxes) {
      if (!(cb in payload)) payload[cb] = false
    }

    const res = await authFetch(`/api/registrations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? "Save failed")
    } else {
      const data = await res.json()
      setRegistration(data.registration)
      setSuccess("Saved successfully")
    }
    setIsSaving(false)
  }

  if (isLoading) return <p className="text-center text-gray-500">Loading...</p>
  if (!registration) return <Alert variant="error">Registration not found</Alert>

  const reg = registration as Record<string, string | boolean | null>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="text-blue-600 hover:underline">← Back</Link>
        <h1 className="text-2xl font-bold">{String(reg.registration_no)}</h1>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <form onSubmit={handleSave} className="space-y-6">
        <fieldset disabled={isSaving} className="space-y-6 border-0 p-0 m-0 min-w-0">
        {canEditRegistration && (
          <Card>
            <CardHeader><CardTitle>Registration Info</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Surname</Label>
                <Input name="surname" defaultValue={String(reg.surname ?? "")} aria-label="Surname" />
              </div>
              <div className="space-y-2">
                <Label>Given Name</Label>
                <Input name="given_name" defaultValue={String(reg.given_name ?? "")} aria-label="Given name" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input name="email" type="email" defaultValue={String(reg.email ?? "")} aria-label="Email" />
              </div>
              <div className="space-y-2">
                <Label>Mobile</Label>
                <Input name="mobile" defaultValue={String(reg.mobile ?? "")} aria-label="Mobile" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="spouse_attending" defaultChecked={!!reg.spouse_attending} aria-label="Spouse attending" />
                Spouse attending
              </label>
            </CardContent>
          </Card>
        )}

        {canEditAccommodation && (
          <Card>
            <CardHeader><CardTitle>Transport &amp; Accommodation</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Accommodation Contact Name</Label>
                <Input name="accommodation_contact_name" defaultValue={String(reg.accommodation_contact_name ?? "")} aria-label="Contact name" />
              </div>
              <div className="space-y-2">
                <Label>Accommodation Contact Phone</Label>
                <Input name="accommodation_contact_phone" defaultValue={String(reg.accommodation_contact_phone ?? "")} aria-label="Contact phone" />
              </div>
              <div className="space-y-2">
                <Label>Hotel Name</Label>
                <Input name="hotel_name" defaultValue={String(reg.hotel_name ?? "")} aria-label="Hotel name" />
              </div>
              <div className="space-y-2">
                <Label>Hotel Address</Label>
                <Input name="hotel_address" defaultValue={String(reg.hotel_address ?? "")} aria-label="Hotel address" />
              </div>
              <div className="space-y-2">
                <Label>Arrival Date</Label>
                <Input name="arrival_date" type="date" defaultValue={String(reg.arrival_date ?? "")} aria-label="Arrival date" />
              </div>
              <div className="space-y-2">
                <Label>Arrival Flight No</Label>
                <Input name="arrival_flight_no" defaultValue={String(reg.arrival_flight_no ?? "")} aria-label="Arrival flight" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="pickup_melbourne_airport" defaultChecked={!!reg.pickup_melbourne_airport} aria-label="Pickup" />
                Pick-up from Tullamarine
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="dropoff_melbourne_airport" defaultChecked={!!reg.dropoff_melbourne_airport} aria-label="Drop-off" />
                Drop-off to Tullamarine
              </label>
            </CardContent>
          </Card>
        )}

        {(canEditRegistration || canEditAccommodation) && (
          <Button
            type="submit"
            isLoading={isSaving}
            loadingText="Saving..."
            disabled={isSaving}
            aria-label="Save changes"
          >
            Save Changes
          </Button>
        )}
        </fieldset>
      </form>
    </div>
  )
}

export default RegistrationDetailPage
