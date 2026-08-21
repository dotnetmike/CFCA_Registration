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
import { formatCurrency } from "@/lib/pricing/calculate"
import {
  AUSTRALIAN_STATES,
  CFCA_POSITIONS,
  CFCA_POSITION_LABELS,
} from "@/lib/registrations/schema"
import {
  ACCOMMODATION_OPTIONS,
  TRANSPORT_OPTIONS,
  booleansToTransportOption,
  getAccommodationLabel,
  getTransportFlightSections,
  getTransportOptionLabel,
  transportOptionToBooleans,
} from "@/lib/registrations/transport"
import {
  hasRegistrationChanges,
  snapshotFromFormValues,
  snapshotFromRegistration,
} from "@/lib/registrations/compare"

type Attendee = {
  surname?: string
  given_name?: string
  age?: number
  needs_kids_supervision?: boolean
}

const Field = ({
  label,
  name,
  defaultValue,
  type = "text",
  readOnly,
  children,
}: {
  label: string
  name?: string
  defaultValue?: string
  type?: string
  readOnly: boolean
  children?: React.ReactNode
}) => (
  <div className="space-y-2">
    <Label htmlFor={name}>{label}</Label>
    {children ?? (
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        readOnly={readOnly}
        disabled={readOnly}
        className={readOnly ? "bg-gray-50 text-gray-800" : undefined}
        aria-label={label}
        aria-readonly={readOnly}
      />
    )}
  </div>
)

const RegistrationDetailPage = () => {
  const params = useParams()
  const id = params.id as string
  const { user, authFetch } = useAuth()
  const router = useRouter()
  const [registration, setRegistration] = useState<Record<string, unknown> | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [transportOption, setTransportOption] = useState<
    "own" | "pickup" | "dropoff" | "pickup_dropoff"
  >("own")
  const [sameTransportContact, setSameTransportContact] = useState(true)
  const [notes, setNotes] = useState<
    { id: string; body: string; created_at: string; created_by_name: string }[]
  >([])
  const [noteBody, setNoteBody] = useState("")
  const [isSavingPayment, setIsSavingPayment] = useState(false)
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [paymentAmountPaid, setPaymentAmountPaid] = useState("")
  const [paymentStatus, setPaymentStatus] = useState("pending")
  useBusyCursor(isSaving || isSavingPayment || isSavingNote)

  const canEditRegistration = !!user?.permissions.includes("registrations:write_all")
  const canEditAccommodation = !!user?.permissions.includes("accommodation:write_all")
  const canEdit = canEditRegistration || canEditAccommodation
  const canManagePayment =
    !!user?.permissions.includes("payments:reconcile") ||
    !!user?.permissions.includes("registrations:write_all")
  const canAddNotes =
    !!user?.permissions.includes("registrations:read_all") &&
    (!!user?.permissions.includes("registrations:write_all") ||
      !!user?.permissions.includes("accommodation:write_all") ||
      !!user?.permissions.includes("payments:reconcile") ||
      !!user?.permissions.includes("users:manage"))

  useEffect(() => {
    if (!user) return
    if (!isManager(user)) {
      router.push("/")
      return
    }

    const load = async () => {
      const [regRes, notesRes] = await Promise.all([
        authFetch(`/api/registrations/${id}`),
        authFetch(`/api/registrations/${id}/notes`),
      ])
      if (regRes.ok) {
        const data = await regRes.json()
        setRegistration(data.registration)
        setPaymentAmountPaid(String(data.registration?.amount_paid ?? 0))
        setPaymentStatus(String(data.registration?.payment_status ?? "pending"))
      }
      if (notesRes.ok) {
        const data = await notesRes.json()
        setNotes(data.notes ?? [])
      }
      setIsLoading(false)
    }
    load()
  }, [user, authFetch, id, router])

  useEffect(() => {
    if (!registration) return
    const reg = registration as Record<string, string | boolean | number | null>
    const option = booleansToTransportOption(
      reg.pickup_melbourne_airport as boolean | null,
      reg.dropoff_melbourne_airport as boolean | null
    )
    setTransportOption(option)

    const pickupName = String(reg.pickup_transport_contact_name ?? "")
    const pickupPhone = String(reg.pickup_transport_contact_phone ?? "")
    const dropoffName = String(reg.dropoff_transport_contact_name ?? "")
    const dropoffPhone = String(reg.dropoff_transport_contact_phone ?? "")
    const bothEmpty = !pickupName && !pickupPhone && !dropoffName && !dropoffPhone
    setSameTransportContact(
      bothEmpty || (pickupName === dropoffName && pickupPhone === dropoffPhone)
    )
  }, [registration, formKey])

  const handleStartEdit = () => {
    setSuccess("")
    setError("")
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setError("")
    setSuccess("")
    setFormKey((k) => k + 1)
  }

  const handleSavePayment = async () => {
    if (!registration || !canManagePayment) return

    if (
      Number(paymentAmountPaid) === Number(registration.amount_paid ?? 0) &&
      paymentStatus === String(registration.payment_status ?? "pending")
    ) {
      setError("")
      setSuccess("No payment changes to save.")
      return
    }

    const confirmed = window.confirm(
      "Update payment status and amount paid for this registration?"
    )
    if (!confirmed) return

    setError("")
    setSuccess("")
    setIsSavingPayment(true)
    const res = await authFetch(`/api/registrations/${id}/payment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount_paid: Number(paymentAmountPaid),
        payment_status: paymentStatus,
      }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? "Payment update failed")
    } else {
      const data = await res.json()
      if (data.unchanged) {
        setSuccess("No payment changes to save.")
      } else {
        setRegistration(data.registration)
        setPaymentAmountPaid(String(data.registration?.amount_paid ?? 0))
        setPaymentStatus(String(data.registration?.payment_status ?? "pending"))
        setSuccess("Payment updated successfully.")
      }
    }
    setIsSavingPayment(false)
  }

  const handleAddNote = async () => {
    if (!canAddNotes || !noteBody.trim()) return
    setError("")
    setSuccess("")
    setIsSavingNote(true)
    const res = await authFetch(`/api/registrations/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: noteBody.trim() }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? "Could not add note")
    } else {
      const data = await res.json()
      setNotes((prev) => [data.note, ...prev])
      setNoteBody("")
      setSuccess("Note added.")
    }
    setIsSavingNote(false)
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!registration || !isEditing) return

    setError("")
    setSuccess("")

    const formData = new FormData(e.currentTarget)
    const payload: Record<string, unknown> = {}

    for (const [key, value] of formData.entries()) {
      if (key === "transport_option") {
        Object.assign(
          payload,
          transportOptionToBooleans(
            String(value) as Parameters<typeof transportOptionToBooleans>[0]
          )
        )
        continue
      }
      if (key === "shared_transport_contact_name" || key === "shared_transport_contact_phone") {
        continue
      }
      if (key.startsWith("cb_")) {
        payload[key.replace("cb_", "")] = true
      } else if (value === "on") {
        payload[key] = true
      } else {
        payload[key] = value
      }
    }

    const selectedTransport = String(
      formData.get("transport_option") ?? transportOption
    ) as Parameters<typeof transportOptionToBooleans>[0]
    const needsPickup =
      selectedTransport === "pickup" || selectedTransport === "pickup_dropoff"
    const needsDropoff =
      selectedTransport === "dropoff" || selectedTransport === "pickup_dropoff"

    if (canEditAccommodation) {
      if (needsPickup && needsDropoff && sameTransportContact) {
        const sharedName = String(formData.get("shared_transport_contact_name") ?? "")
        const sharedPhone = String(formData.get("shared_transport_contact_phone") ?? "")
        payload.pickup_transport_contact_name = sharedName
        payload.pickup_transport_contact_phone = sharedPhone
        payload.dropoff_transport_contact_name = sharedName
        payload.dropoff_transport_contact_phone = sharedPhone
      } else {
        if (!needsPickup) {
          payload.pickup_transport_contact_name = ""
          payload.pickup_transport_contact_phone = ""
        }
        if (!needsDropoff) {
          payload.dropoff_transport_contact_name = ""
          payload.dropoff_transport_contact_phone = ""
        }
      }
    }

    const checkboxes = [
      "spouse_attending",
      "pickup_melbourne_airport",
      "dropoff_melbourne_airport",
      "hotel_transport_required",
    ]
    for (const cb of checkboxes) {
      if (!(cb in payload) && (canEditRegistration || canEditAccommodation)) {
        if (cb === "spouse_attending" && canEditRegistration) payload[cb] = false
        if (cb !== "spouse_attending" && canEditAccommodation) payload[cb] = false
      }
    }

    const attendees =
      (registration.registration_attendees as Attendee[] | undefined) ??
      (registration.attendees as Attendee[] | undefined) ??
      []
    payload.attendees = attendees.map((a) => ({
      surname: a.surname ?? "",
      given_name: a.given_name ?? "",
      age: Number(a.age ?? 0),
      needs_kids_supervision: !!a.needs_kids_supervision,
    }))
    payload.transport_option = selectedTransport

    const before = snapshotFromRegistration(registration, attendees)
    const after = snapshotFromFormValues(payload)
    if (!hasRegistrationChanges(before, after)) {
      setSuccess("No changes to save.")
      setIsEditing(false)
      return
    }

    const confirmed = window.confirm(
      "Are you sure you want to update this registration? The registrant’s record will be changed and they may receive an update email."
    )
    if (!confirmed) return

    setIsSaving(true)

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
      if (data.unchanged) {
        setSuccess("No changes to save.")
      } else {
        setRegistration(data.registration)
        setSuccess("Registration updated successfully.")
      }
      setIsEditing(false)
      setFormKey((k) => k + 1)
    }
    setIsSaving(false)
  }

  if (isLoading) return <p className="text-center text-gray-500">Loading...</p>
  if (!registration) return <Alert variant="error">Registration not found</Alert>

  const reg = registration as Record<string, string | boolean | number | null>
  const attendees =
    (registration.registration_attendees as Attendee[] | undefined) ??
    (registration.attendees as Attendee[] | undefined) ??
    []
  const transportValue = booleansToTransportOption(
    reg.pickup_melbourne_airport as boolean | null,
    reg.dropoff_melbourne_airport as boolean | null
  )
  const { showArrival, showDeparture } = getTransportFlightSections(transportOption)
  const needsPickup =
    transportOption === "pickup" || transportOption === "pickup_dropoff"
  const needsDropoff =
    transportOption === "dropoff" || transportOption === "pickup_dropoff"
  const readOnly = !isEditing
  const str = (key: string) => String(reg[key] ?? "")
  const sharedTransportName =
    str("pickup_transport_contact_name") || str("dropoff_transport_contact_name")
  const sharedTransportPhone =
    str("pickup_transport_contact_phone") || str("dropoff_transport_contact_phone")

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-blue-600 hover:underline">
            ← Back to list
          </Link>
          <h1 className="text-2xl font-bold">{str("registration_no")}</h1>
        </div>
        {canEdit && !isEditing && (
          <Button type="button" onClick={handleStartEdit} aria-label="Edit registration">
            Edit
          </Button>
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {isEditing && (
        <Alert variant="warning">
          <strong>Warning:</strong> You are editing this registration. Changes will update the
          registrant&apos;s official record and may trigger a notification email. Proceed carefully.
        </Alert>
      )}

      {!isEditing && (
        <Alert variant="info">
          Viewing in read-only mode. Click <strong>Edit</strong> to make changes
          {canEdit ? "" : " (you do not have write permission)"}.
        </Alert>
      )}

      <form key={formKey} onSubmit={handleSave} className="space-y-6">
        <fieldset disabled={isSaving} className="m-0 min-w-0 space-y-6 border-0 p-0">
          <Card>
            <CardHeader>
              <CardTitle>Registration Info</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Surname" name="surname" defaultValue={str("surname")} readOnly={readOnly || !canEditRegistration} />
              <Field label="Given Name" name="given_name" defaultValue={str("given_name")} readOnly={readOnly || !canEditRegistration} />
              <Field label="Email" name="email" type="email" defaultValue={str("email")} readOnly={readOnly || !canEditRegistration} />
              <Field label="Mobile" name="mobile" defaultValue={str("mobile")} readOnly={readOnly || !canEditRegistration} />
              <Field label="Address" name="address_line1" defaultValue={str("address_line1")} readOnly={readOnly || !canEditRegistration} />
              <Field label="Suburb" name="suburb" defaultValue={str("suburb")} readOnly={readOnly || !canEditRegistration} />
              <Field label="Postcode" name="postcode" defaultValue={str("postcode")} readOnly={readOnly || !canEditRegistration} />
              <div className="space-y-2">
                <Label htmlFor="address_state">Address State</Label>
                <select
                  id="address_state"
                  name="address_state"
                  defaultValue={str("address_state")}
                  disabled={readOnly || !canEditRegistration}
                  className="flex h-10 w-full rounded-md border border-gray-300 px-3 text-sm disabled:bg-gray-50"
                  aria-label="Address state"
                >
                  <option value="">—</option>
                  {AUSTRALIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">Conference State</Label>
                <select
                  id="state"
                  name="state"
                  defaultValue={str("state")}
                  disabled={readOnly || !canEditRegistration}
                  className="flex h-10 w-full rounded-md border border-gray-300 px-3 text-sm disabled:bg-gray-50"
                  aria-label="Conference state"
                >
                  <option value="">—</option>
                  {AUSTRALIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cfca_position">CFCA Position</Label>
                <select
                  id="cfca_position"
                  name="cfca_position"
                  defaultValue={str("cfca_position") || "member"}
                  disabled={readOnly || !canEditRegistration}
                  className="flex h-10 w-full rounded-md border border-gray-300 px-3 text-sm disabled:bg-gray-50"
                  aria-label="CFCA position"
                >
                  {CFCA_POSITIONS.map((p) => (
                    <option key={p} value={p}>{CFCA_POSITION_LABELS[p]}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input
                  type="checkbox"
                  name="spouse_attending"
                  defaultChecked={!!reg.spouse_attending}
                  disabled={readOnly || !canEditRegistration}
                  aria-label="Spouse attending"
                />
                Spouse attending
              </label>
              <Field label="Spouse Surname" name="spouse_surname" defaultValue={str("spouse_surname")} readOnly={readOnly || !canEditRegistration} />
              <Field label="Spouse Given Name" name="spouse_given_name" defaultValue={str("spouse_given_name")} readOnly={readOnly || !canEditRegistration} />
              <Field label="Spouse Email" name="spouse_email" type="email" defaultValue={str("spouse_email")} readOnly={readOnly || !canEditRegistration} />
              <Field label="Spouse Mobile" name="spouse_mobile" defaultValue={str("spouse_mobile")} readOnly={readOnly || !canEditRegistration} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment &amp; References</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm md:grid-cols-2">
              <div>
                <strong>Unique Code:</strong>{" "}
                <span className="font-mono font-bold text-red-600">
                  {str("participant_reference") || "—"}
                </span>
              </div>
              <div>
                <strong>Registration No:</strong> {str("registration_no")}
              </div>
              <div>
                <strong>Amount Due:</strong> {formatCurrency(Number(reg.amount_due ?? 0))}
              </div>
              <div>
                <strong>Remaining balance:</strong>{" "}
                {formatCurrency(
                  Math.max(0, Number(reg.amount_due ?? 0) - Number(reg.amount_paid ?? 0))
                )}
              </div>
              <div>
                <strong>Submitted:</strong>{" "}
                {reg.submitted_at ? new Date(String(reg.submitted_at)).toLocaleString() : "Draft"}
              </div>
              <div className="md:col-span-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
                <strong>Last payment update:</strong>{" "}
                {reg.payment_last_updated_at ? (
                  <>
                    {String(reg.payment_last_updated_source) === "manual"
                      ? "Manually by admin"
                      : String(reg.payment_last_updated_source) === "bank_reconcile"
                        ? "By bank reconciliation"
                        : "Updated"}
                    {" — "}
                    {str("payment_last_updated_by_name") || "Unknown"}
                    {" on "}
                    {new Date(String(reg.payment_last_updated_at)).toLocaleString()}
                  </>
                ) : (
                  "No payment updates recorded yet"
                )}
              </div>

              {canManagePayment ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="admin_amount_paid">Amount paid</Label>
                    <Input
                      id="admin_amount_paid"
                      type="number"
                      min={0}
                      step="0.01"
                      value={paymentAmountPaid}
                      onChange={(e) => setPaymentAmountPaid(e.target.value)}
                      disabled={isSavingPayment}
                      aria-label="Amount paid"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin_payment_status">Payment status</Label>
                    <select
                      id="admin_payment_status"
                      value={paymentStatus}
                      onChange={(e) => setPaymentStatus(e.target.value)}
                      disabled={isSavingPayment}
                      className="flex h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                      aria-label="Payment status"
                    >
                      <option value="pending">pending</option>
                      <option value="partial">partial</option>
                      <option value="paid">paid</option>
                      <option value="overpaid">overpaid</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <Button
                      type="button"
                      onClick={handleSavePayment}
                      isLoading={isSavingPayment}
                      loadingText="Updating payment..."
                      disabled={isSavingPayment}
                      aria-label="Update payment"
                    >
                      Update payment
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <strong>Status:</strong> {str("payment_status")}
                  </div>
                  <div>
                    <strong>Amount Paid:</strong> {formatCurrency(Number(reg.amount_paid ?? 0))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Additional Attendees</CardTitle>
            </CardHeader>
            <CardContent>
              {attendees.length === 0 ? (
                <p className="text-sm text-gray-500">No additional attendees</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {attendees.map((a, i) => (
                    <li key={i}>
                      {a.given_name} {a.surname} (age {a.age})
                      {a.needs_kids_supervision ? " — kids supervision" : ""}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Accommodation</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {!isEditing ? (
                <div className="text-sm md:col-span-2">
                  <strong>Type:</strong>{" "}
                  {getAccommodationLabel(str("accommodation_type")) || "—"}
                </div>
              ) : (
                canEditAccommodation && (
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="accommodation_type">Accommodation</Label>
                    <select
                      id="accommodation_type"
                      name="accommodation_type"
                      defaultValue={str("accommodation_type")}
                      className="flex h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                      aria-label="Accommodation"
                    >
                      <option value="">—</option>
                      {ACCOMMODATION_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                )
              )}

              <Field
                label="Accommodation name"
                name="hotel_name"
                defaultValue={str("hotel_name")}
                readOnly={readOnly || !canEditAccommodation}
              />
              <Field
                label="Accommodation address"
                name="hotel_address"
                defaultValue={str("hotel_address")}
                readOnly={readOnly || !canEditAccommodation}
              />
              <Field
                label="Accommodation contact name"
                name="accommodation_contact_name"
                defaultValue={str("accommodation_contact_name")}
                readOnly={readOnly || !canEditAccommodation}
              />
              <Field
                label="Accommodation contact phone"
                name="accommodation_contact_phone"
                defaultValue={str("accommodation_contact_phone")}
                readOnly={readOnly || !canEditAccommodation}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Transportation</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {!isEditing ? (
                <div className="text-sm md:col-span-2">
                  <strong>Airport transport:</strong> {getTransportOptionLabel(transportValue)}
                </div>
              ) : (
                canEditAccommodation && (
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="transport_option">Airport transport</Label>
                    <select
                      id="transport_option"
                      name="transport_option"
                      value={transportOption}
                      onChange={(e) =>
                        setTransportOption(
                          e.target.value as
                            | "own"
                            | "pickup"
                            | "dropoff"
                            | "pickup_dropoff"
                        )
                      }
                      className="flex h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                      aria-label="Airport transport"
                    >
                      {TRANSPORT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                )
              )}

              {(showArrival || (!isEditing && !!str("arrival_date"))) && (
                <>
                  <Field
                    label="Arrival date"
                    name="arrival_date"
                    type="date"
                    defaultValue={str("arrival_date").slice(0, 10)}
                    readOnly={readOnly || !canEditAccommodation}
                  />
                  <Field
                    label="Arrival airport"
                    name="arrival_airport"
                    defaultValue={str("arrival_airport")}
                    readOnly={readOnly || !canEditAccommodation}
                  />
                  <Field
                    label="Arrival flight no"
                    name="arrival_flight_no"
                    defaultValue={str("arrival_flight_no")}
                    readOnly={readOnly || !canEditAccommodation}
                  />
                </>
              )}

              {(showDeparture || (!isEditing && !!str("departure_date"))) && (
                <>
                  <Field
                    label="Departure date"
                    name="departure_date"
                    type="date"
                    defaultValue={str("departure_date").slice(0, 10)}
                    readOnly={readOnly || !canEditAccommodation}
                  />
                  <Field
                    label="Departure airport"
                    name="departure_airport"
                    defaultValue={str("departure_airport")}
                    readOnly={readOnly || !canEditAccommodation}
                  />
                  <Field
                    label="Departure flight no"
                    name="departure_flight_no"
                    defaultValue={str("departure_flight_no")}
                    readOnly={readOnly || !canEditAccommodation}
                  />
                </>
              )}

              {!needsPickup && !needsDropoff && (
                <p className="text-sm text-gray-600 md:col-span-2">
                  No airport transport requested — transport contacts are not required.
                </p>
              )}

              {needsPickup && needsDropoff && (
                <label className="flex items-center gap-2 text-sm md:col-span-2">
                  <input
                    type="checkbox"
                    checked={sameTransportContact}
                    onChange={(e) => setSameTransportContact(e.target.checked)}
                    disabled={readOnly || !canEditAccommodation}
                    aria-label="Same contact for pickup and drop-off"
                  />
                  Same contact for pickup and drop-off
                </label>
              )}

              {needsPickup && needsDropoff && sameTransportContact && (
                <>
                  <Field
                    label="Transportation contact name"
                    name="shared_transport_contact_name"
                    defaultValue={sharedTransportName}
                    readOnly={readOnly || !canEditAccommodation}
                  />
                  <Field
                    label="Transportation contact phone"
                    name="shared_transport_contact_phone"
                    defaultValue={sharedTransportPhone}
                    readOnly={readOnly || !canEditAccommodation}
                  />
                </>
              )}

              {needsPickup && !(needsDropoff && sameTransportContact) && (
                <>
                  <Field
                    label="Pickup contact name"
                    name="pickup_transport_contact_name"
                    defaultValue={str("pickup_transport_contact_name")}
                    readOnly={readOnly || !canEditAccommodation}
                  />
                  <Field
                    label="Pickup contact phone"
                    name="pickup_transport_contact_phone"
                    defaultValue={str("pickup_transport_contact_phone")}
                    readOnly={readOnly || !canEditAccommodation}
                  />
                </>
              )}

              {needsDropoff && !(needsPickup && sameTransportContact) && (
                <>
                  <Field
                    label="Drop-off contact name"
                    name="dropoff_transport_contact_name"
                    defaultValue={str("dropoff_transport_contact_name")}
                    readOnly={readOnly || !canEditAccommodation}
                  />
                  <Field
                    label="Drop-off contact phone"
                    name="dropoff_transport_contact_phone"
                    defaultValue={str("dropoff_transport_contact_phone")}
                    readOnly={readOnly || !canEditAccommodation}
                  />
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Admin notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {canAddNotes && (
                <div className="space-y-2">
                  <Label htmlFor="admin_note">Add note</Label>
                  <textarea
                    id="admin_note"
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    rows={3}
                    disabled={isSavingNote}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    aria-label="Admin note"
                    placeholder="Add an internal comment about this registrant..."
                  />
                  <Button
                    type="button"
                    onClick={handleAddNote}
                    isLoading={isSavingNote}
                    loadingText="Adding note..."
                    disabled={isSavingNote || !noteBody.trim()}
                    aria-label="Add admin note"
                  >
                    Add note
                  </Button>
                </div>
              )}
              {notes.length === 0 ? (
                <p className="text-sm text-gray-500">No admin notes yet.</p>
              ) : (
                <ul className="space-y-3">
                  {notes.map((note) => (
                    <li
                      key={note.id}
                      className="rounded-md border border-gray-200 bg-white p-3 text-sm"
                    >
                      <p className="whitespace-pre-wrap text-gray-900">{note.body}</p>
                      <p className="mt-2 text-xs text-gray-500">
                        {note.created_by_name} ·{" "}
                        {new Date(note.created_at).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {isEditing && canEdit && (
            <div className="flex flex-wrap gap-3">
              <Button
                type="submit"
                isLoading={isSaving}
                loadingText="Saving..."
                disabled={isSaving}
                aria-label="Save registration changes"
              >
                Save Changes
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelEdit}
                disabled={isSaving}
                aria-label="Cancel editing"
              >
                Cancel
              </Button>
            </div>
          )}
        </fieldset>
      </form>
    </div>
  )
}

export default RegistrationDetailPage
