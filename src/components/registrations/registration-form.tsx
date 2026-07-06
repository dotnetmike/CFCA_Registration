"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useAuth } from "@/lib/auth/context"
import {
  registrationSchema,
  type RegistrationFormData,
  type RegistrationFormInput,
  CFCA_POSITIONS,
  CFCA_POSITION_LABELS,
  AUSTRALIAN_STATES,
} from "@/lib/registrations/schema"
import { parseFullName } from "@/lib/registrations/parse-name"
import {
  ACCOMMODATION_OPTIONS,
  booleansToTransportOption,
  getTransportFlightSections,
  TRANSPORT_OPTIONS,
  type TransportOption,
} from "@/lib/registrations/transport"
import { TransportScheduleAlert } from "@/components/registrations/transport-schedule-alert"
import { AustralianAddressAutocomplete } from "@/components/address/australian-address-autocomplete"
import { RegistrationReviewSummary } from "@/components/registrations/registration-review-summary"
import type { AustralianAddress } from "@/lib/address/parse"
import { useBusyCursor } from "@/hooks/use-busy-cursor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert } from "@/components/ui/alert"

const STEPS = ["Personal", "Attendees", "Transport", "Review"]

const FieldError = ({ message }: { message?: string }) =>
  message ? <p className="text-xs text-red-600" role="alert">{message}</p> : null

const RegistrationForm = () => {
  const { authFetch, user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [saveAction, setSaveAction] = useState<"next" | "submit" | "step" | null>(null)
  const isBusy = saveAction !== null
  useBusyCursor(isBusy)
  const [error, setError] = useState("")
  const [registrationId, setRegistrationId] = useState<string | null>(null)
  const [participantReference, setParticipantReference] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const form = useForm<RegistrationFormInput>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      surname: "",
      given_name: "",
      email: user?.email ?? "",
      mobile: "",
      cfca_position: "member",
      state: undefined,
      accommodation_type: "own",
      spouse_attending: false,
      attendees: [],
      transport_option: "own",
      submit: false,
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "attendees" })
  const watchAll = form.watch()
  const spouseAttending = watchAll.spouse_attending
  const accommodationType = watchAll.accommodation_type
  const transportOption = watchAll.transport_option as TransportOption | "" | undefined
  const { showArrival, showDeparture } = getTransportFlightSections(transportOption)
  const needsAirportTransport = showArrival || showDeparture

  const loadRegistration = useCallback(async () => {
    setIsLoading(true)
    const res = await authFetch("/api/registrations")
    if (res.ok) {
      const data = await res.json()
      if (data.registration) {
        setRegistrationId(data.registration.id)
        setParticipantReference(data.registration.participant_reference ?? null)
        setSubmitted(!!data.registration.submitted_at)
        form.reset({
          surname: data.registration.surname,
          given_name: data.registration.given_name,
          email: data.registration.email,
          mobile: data.registration.mobile,
          address_line1: data.registration.address_line1,
          suburb: data.registration.suburb,
          address_state: data.registration.address_state ?? undefined,
          postcode: data.registration.postcode,
          cfca_position: data.registration.cfca_position ?? "member",
          state: data.registration.state,
          spouse_surname: data.registration.spouse_surname,
          spouse_given_name: data.registration.spouse_given_name,
          spouse_attending: data.registration.spouse_attending,
          spouse_email: data.registration.spouse_email,
          spouse_mobile: data.registration.spouse_mobile,
          accommodation_type: data.registration.accommodation_type ?? "own",
          transport_option: booleansToTransportOption(
            data.registration.pickup_melbourne_airport,
            data.registration.dropoff_melbourne_airport
          ),
          pickup_melbourne_airport: data.registration.pickup_melbourne_airport,
          dropoff_melbourne_airport: data.registration.dropoff_melbourne_airport,
          hotel_transport_required: data.registration.hotel_transport_required,
          arrival_date: data.registration.arrival_date ?? "",
          arrival_airport: data.registration.arrival_airport,
          arrival_flight_no: data.registration.arrival_flight_no,
          departure_date: data.registration.departure_date ?? "",
          departure_airport: data.registration.departure_airport,
          departure_flight_no: data.registration.departure_flight_no,
          hotel_name: data.registration.hotel_name,
          hotel_address: data.registration.hotel_address,
          attendees: data.registration.registration_attendees?.map((a: {
            surname: string
            given_name: string
            age: number
            needs_kids_supervision: boolean
          }) => ({
            surname: a.surname,
            given_name: a.given_name,
            age: a.age,
            needs_kids_supervision: a.needs_kids_supervision,
          })) ?? [],
          submit: false,
        })
      } else if (user) {
        const { given_name, surname } = parseFullName(user.name)
        form.reset({
          surname,
          given_name,
          email: user.email,
          mobile: "",
          cfca_position: "member",
          accommodation_type: "own",
          transport_option: "own",
          spouse_attending: false,
          attendees: [],
          submit: false,
        })
      }
    }
    setIsLoading(false)
  }, [form, authFetch, user])

  useEffect(() => {
    if (!authLoading) {
      loadRegistration()
    }
  }, [loadRegistration, authLoading])

  const handleAddressSelect = (address: AustralianAddress) => {
    form.setValue("address_line1", address.address_line1)
    form.setValue("suburb", address.suburb)
    form.setValue("postcode", address.postcode)
    if (address.address_state) {
      form.setValue("address_state", address.address_state)
      if (!form.getValues("state")) {
        form.setValue("state", address.address_state)
      }
    }
  }

  const save = async (
    submit = false,
    action: "next" | "submit" | "step" = "next",
    assignParticipantReference = false
  ): Promise<boolean> => {
    setError("")
    setSaveAction(action)
    const values = form.getValues()
    const payload = { ...values, submit, assign_participant_reference: assignParticipantReference }

    let currentId = registrationId

    if (!currentId) {
      const existingRes = await authFetch("/api/registrations")
      if (existingRes.ok) {
        const existingData = await existingRes.json()
        if (existingData.registration?.id) {
          currentId = existingData.registration.id
          setRegistrationId(currentId)
        }
      }
    }

    const url = currentId ? `/api/registrations/${currentId}` : "/api/registrations"
    const method = currentId ? "PUT" : "POST"

    const res = await authFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? "Save failed")
      setSaveAction(null)
      return false
    }

    const data = await res.json()
    setRegistrationId(data.registration.id)
    if (data.registration.participant_reference) {
      setParticipantReference(data.registration.participant_reference)
    }
    if (submit) {
      setSubmitted(true)
      router.push("/my-registration")
    }
    setSaveAction(null)
    return true
  }

  const handleStepClick = async (targetStep: number) => {
    if (!submitted || targetStep === step || isBusy) return
    const saved = await save(false, "step")
    if (saved) {
      setError("")
      setStep(targetStep)
    }
  }

  const handleNext = async () => {
    const fieldsToValidate: (keyof RegistrationFormData)[] =
      step === 0
        ? ["surname", "given_name", "email", "mobile", "state"]
        : []

    if (fieldsToValidate.length > 0) {
      const valid = await form.trigger(fieldsToValidate)
      if (!valid) {
        setError("Please complete all required fields marked with * before continuing.")
        return
      }
    }

    const saved = await save(false, "next", step === 0)
    if (saved && step < STEPS.length - 1) {
      setError("")
      setStep(step + 1)
    }
  }

  const handleSubmit = async () => {
    const valid = await form.trigger()
    if (!valid) return
    await save(true, "submit")
  }

  if (isLoading) return <p className="text-center text-gray-500">Loading registration...</p>

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Conference Registration</h1>

      <div className="flex gap-2" role="tablist" aria-label="Registration steps">
        {STEPS.map((s, i) => {
          const isActive = i === step
          const stepClassName = `flex-1 rounded-md px-3 py-2 text-center text-sm font-medium ${
            isActive ? "bg-blue-600 text-white" : i < step ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-500"
          }`

          if (submitted) {
            return (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Go to ${s}`}
                onClick={() => handleStepClick(i)}
                disabled={isBusy}
                className={`${stepClassName} cursor-pointer transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {s}
              </button>
            )
          }

          return (
            <div
              key={s}
              role="tab"
              aria-selected={isActive}
              className={stepClassName}
            >
              {s}
            </div>
          )
        })}
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {submitted && (
        <Alert variant="success">Your registration has been submitted. You can still update details below.</Alert>
      )}

      <form
        onSubmit={(e) => e.preventDefault()}
        className="space-y-6"
      >
        <fieldset disabled={isBusy} className="space-y-6 border-0 p-0 m-0 min-w-0">
        {step === 0 && (
          <Card>
            <CardHeader><CardTitle>Personal Details</CardTitle></CardHeader>
            <CardContent className="grid gap-4 overflow-visible md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="surname">Surname *</Label>
                <Input id="surname" {...form.register("surname")} aria-label="Surname" />
                <FieldError message={form.formState.errors.surname?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="given_name">Name *</Label>
                <Input id="given_name" {...form.register("given_name")} aria-label="Given name" />
                <FieldError message={form.formState.errors.given_name?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" {...form.register("email")} aria-label="Email" />
                <FieldError message={form.formState.errors.email?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile Phone *</Label>
                <Input id="mobile" {...form.register("mobile")} aria-label="Mobile phone" />
                <FieldError message={form.formState.errors.mobile?.message} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <AustralianAddressAutocomplete
                  label="Address"
                  value={form.watch("address_line1") ?? ""}
                  onChange={(value) => form.setValue("address_line1", value)}
                  onAddressSelect={handleAddressSelect}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="suburb">Suburb</Label>
                <Input id="suburb" {...form.register("suburb")} aria-label="Suburb" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postcode">Postcode</Label>
                <Input id="postcode" {...form.register("postcode")} aria-label="Postcode" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_state">Address State</Label>
                <select
                  id="address_state"
                  className="flex h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                  {...form.register("address_state")}
                  aria-label="Address state"
                >
                  <option value="">Select state</option>
                  {AUSTRALIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">Conference State *</Label>
                <select
                  id="state"
                  className="flex h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                  {...form.register("state")}
                  aria-label="State"
                >
                  <option value="">Select state</option>
                  {AUSTRALIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <FieldError message={form.formState.errors.state?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cfca_position">Position in CFCA</Label>
                <select
                  id="cfca_position"
                  className="flex h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                  {...form.register("cfca_position")}
                  aria-label="CFCA position"
                >
                  {CFCA_POSITIONS.map((p) => (
                    <option key={p} value={p}>{CFCA_POSITION_LABELS[p]}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 space-y-4 border-t pt-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" {...form.register("spouse_attending")} aria-label="Spouse attending" />
                  Spouse is attending
                </label>
                {spouseAttending && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Spouse Surname</Label>
                      <Input {...form.register("spouse_surname")} aria-label="Spouse surname" />
                    </div>
                    <div className="space-y-2">
                      <Label>Spouse Name</Label>
                      <Input {...form.register("spouse_given_name")} aria-label="Spouse given name" />
                    </div>
                    <div className="space-y-2">
                      <Label>Spouse Email</Label>
                      <Input type="email" {...form.register("spouse_email")} aria-label="Spouse email" />
                    </div>
                    <div className="space-y-2">
                      <Label>Spouse Mobile</Label>
                      <Input {...form.register("spouse_mobile")} aria-label="Spouse mobile" />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <CardHeader><CardTitle>Other Attendees</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">Add children or other family members attending (0 or more).</p>
              {fields.map((field, index) => (
                <div key={field.id} className="grid gap-4 rounded-md border p-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Surname</Label>
                    <Input {...form.register(`attendees.${index}.surname`)} aria-label={`Attendee ${index + 1} surname`} />
                  </div>
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input {...form.register(`attendees.${index}.given_name`)} aria-label={`Attendee ${index + 1} name`} />
                  </div>
                  <div className="space-y-2">
                    <Label>Age</Label>
                    <Input type="number" min={0} {...form.register(`attendees.${index}.age`, { valueAsNumber: true })} aria-label={`Attendee ${index + 1} age`} />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" variant="destructive" size="sm" onClick={() => remove(index)} aria-label={`Remove attendee ${index + 1}`}>
                      Remove
                    </Button>
                  </div>
                  {(form.watch(`attendees.${index}.age`) ?? 0) < 12 && (
                    <label className="flex items-center gap-2 text-sm md:col-span-4">
                      <input type="checkbox" {...form.register(`attendees.${index}.needs_kids_supervision`)} aria-label={`Kids supervision for attendee ${index + 1}`} />
                      Kids supervision required (under 12)
                    </label>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => append({ surname: "", given_name: "", age: 0, needs_kids_supervision: false })}
                aria-label="Add attendee"
              >
                Add Attendee
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader><CardTitle>Transport &amp; Accommodation</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="accommodation_type">Accommodation during conference</Label>
                <select
                  id="accommodation_type"
                  className="flex h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                  {...form.register("accommodation_type")}
                  aria-label="Accommodation during conference"
                >
                  {ACCOMMODATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {accommodationType === "billet" && (
                <Alert variant="info">
                  Please note that we are only limiting our accommodation from Friday till Sunday
                  during the conference unless you have your own agreement with our fellow bros and sis.
                </Alert>
              )}

              {accommodationType === "own" && (
                <Alert variant="info">
                  You have selected <strong>self arranged</strong> accommodation — you will manage
                  your own stay during the conference.
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="transport_option">Airport transport (Tullamarine)</Label>
                <select
                  id="transport_option"
                  className="flex h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                  {...form.register("transport_option")}
                  aria-label="Airport transport option"
                >
                  {TRANSPORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {transportOption && transportOption !== "own" && (
                <TransportScheduleAlert transportOption={transportOption} />
              )}

              {needsAirportTransport && (
                <>
                  {showArrival && (
                    <>
                      <h3 className="font-semibold">Arrival Flight</h3>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Date of Arrival</Label>
                          <Input type="date" {...form.register("arrival_date")} aria-label="Arrival date" />
                        </div>
                        <div className="space-y-2">
                          <Label>Airport</Label>
                          <Input {...form.register("arrival_airport")} aria-label="Arrival airport" />
                        </div>
                        <div className="space-y-2">
                          <Label>Flight No.</Label>
                          <Input {...form.register("arrival_flight_no")} aria-label="Arrival flight number" />
                        </div>
                      </div>
                    </>
                  )}

                  {showDeparture && (
                    <>
                      <h3 className="font-semibold">Departure Flight</h3>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Date of Departure</Label>
                          <Input type="date" {...form.register("departure_date")} aria-label="Departure date" />
                        </div>
                        <div className="space-y-2">
                          <Label>Airport</Label>
                          <Input {...form.register("departure_airport")} aria-label="Departure airport" />
                        </div>
                        <div className="space-y-2">
                          <Label>Flight No.</Label>
                          <Input {...form.register("departure_flight_no")} aria-label="Departure flight number" />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader><CardTitle>Review &amp; Submit</CardTitle></CardHeader>
            <CardContent>
              <RegistrationReviewSummary
                formData={watchAll as RegistrationFormData}
                participantReference={participantReference}
              />
            </CardContent>
          </Card>
        )}

        <div className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0 || isBusy}
            aria-label="Previous step"
          >
            Back
          </Button>
          <div className="flex gap-2">
            {step < STEPS.length - 1 ? (
              <Button
                type="button"
                onClick={handleNext}
                isLoading={saveAction === "next"}
                loadingText="Saving..."
                disabled={isBusy}
                aria-label="Next step"
              >
                Next
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                isLoading={saveAction === "submit"}
                loadingText={submitted ? "Submitting changes..." : "Submitting..."}
                disabled={isBusy}
                aria-label={submitted ? "Submit changes" : "Submit registration"}
              >
                {submitted ? "Submit Changes" : "Submit Registration"}
              </Button>
            )}
          </div>
        </div>
        </fieldset>
      </form>
    </div>
  )
}

export default RegistrationForm
