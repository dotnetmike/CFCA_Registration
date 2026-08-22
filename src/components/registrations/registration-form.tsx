"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
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
  getAirportTransportDateWindow,
  getAirportTransportValidationError,
} from "@/lib/registrations/schema"
import {
  ACCOMMODATION_OPTIONS,
  booleansToTransportOption,
  getTransportFlightSections,
  TRANSPORT_OPTIONS,
  type TransportOption,
} from "@/lib/registrations/transport"
import {
  formatSouvenirOrdersSummary,
  normalizeSouvenirOrders,
  souvenirTotalAmount,
  souvenirTotalQuantity,
  TSHIRT_SIZE_LABELS,
  TSHIRT_SIZES,
  TSHIRT_UNIT_PRICE,
} from "@/lib/registrations/souvenirs"
import { TransportScheduleAlert } from "@/components/registrations/transport-schedule-alert"
import { AustralianAddressAutocomplete } from "@/components/address/australian-address-autocomplete"
import { RegistrationReviewSummary } from "@/components/registrations/registration-review-summary"
import type { AustralianAddress } from "@/lib/address/parse"
import {
  snapshotFromFormValues,
} from "@/lib/registrations/compare"
import { useBusyCursor } from "@/hooks/use-busy-cursor"
import { formatCurrency } from "@/lib/pricing/calculate"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert } from "@/components/ui/alert"

const EMAIL_IN_USE_FALLBACK =
  "This email is already registered. Please log in to your account instead."

const selectClassName =
  "flex h-12 w-full rounded-md border border-[color:var(--line-strong)] bg-mist/80 px-3 text-base text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"

const FieldError = ({ message }: { message?: string }) =>
  message ? <p className="text-sm text-[color:var(--danger)]" role="alert">{message}</p> : null

const SectionHeading = ({
  number,
  title,
  description,
}: {
  number: number
  title: string
  description?: string
}) => (
  <div className="space-y-2">
    <CardTitle className="flex items-center gap-3 text-xl md:text-2xl">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-accent/40 bg-[rgba(166,135,78,0.12)] font-display text-lg font-semibold text-accent-ink">
        {number}
      </span>
      <span>{title}</span>
    </CardTitle>
    {description ? <p className="text-base text-ink-soft">{description}</p> : null}
  </div>
)

const RegistrationForm = () => {
  const { authFetch, user, getAuthHeaders, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const errorBannerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [saveAction, setSaveAction] = useState<"submit" | "email-check" | null>(null)
  const isBusy = saveAction !== null
  useBusyCursor(isBusy)
  const [error, setError] = useState("")
  const [emailInUse, setEmailInUse] = useState(false)
  const [registrationId, setRegistrationId] = useState<string | null>(null)
  const [participantReference, setParticipantReference] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [baselineSnapshot, setBaselineSnapshot] = useState<string | null>(null)
  const [info, setInfo] = useState("")

  const form = useForm<RegistrationFormInput>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      surname: "",
      given_name: "",
      email: user?.email ?? "",
      mobile: "",
      dietary_requirements: "",
      cfca_position: "member",
      state: undefined,
      accommodation_type: "",
      spouse_attending: false,
      attendees: [],
      souvenir_orders: [
        { size: "S", quantity: 0 },
        { size: "M", quantity: 0 },
        { size: "L", quantity: 0 },
        { size: "XL", quantity: 0 },
        { size: "2XL", quantity: 0 },
      ],
      transport_option: "",
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
  const pickupDateWindow = getAirportTransportDateWindow("pickup", watchAll.cfca_position)
  const dropoffDateWindow = getAirportTransportDateWindow("dropoff", watchAll.cfca_position)
  const souvenirQty = souvenirTotalQuantity(watchAll.souvenir_orders)
  const souvenirAmount = souvenirTotalAmount(watchAll.souvenir_orders)

  const loadRegistration = useCallback(async () => {
    if (!user) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const res = await authFetch("/api/registrations")
    if (res.ok) {
      const data = await res.json()
      if (data.registration) {
        setRegistrationId(data.registration.id)
        setParticipantReference(data.registration.participant_reference ?? null)
        setSubmitted(!!data.registration.submitted_at)
        const hasTransportSelection =
          data.registration.pickup_melbourne_airport != null ||
          data.registration.dropoff_melbourne_airport != null
        form.reset({
          surname: data.registration.surname,
          given_name: data.registration.given_name,
          email: data.registration.email,
          mobile: data.registration.mobile,
          dietary_requirements: data.registration.dietary_requirements ?? "",
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
          spouse_dietary_requirements: data.registration.spouse_dietary_requirements ?? "",
          accommodation_type: data.registration.accommodation_type ?? "",
          transport_option: hasTransportSelection
            ? booleansToTransportOption(
                data.registration.pickup_melbourne_airport,
                data.registration.dropoff_melbourne_airport
              )
            : "",
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
          souvenir_orders: TSHIRT_SIZES.map((size) => {
            const existing = normalizeSouvenirOrders(data.registration.souvenir_orders)
              .find((line) => line.size === size)
            return { size, quantity: existing?.quantity ?? 0 }
          }),
          attendees: (data.registration.registration_attendees ?? data.registration.attendees ?? []).map(
            (a: {
              surname: string
              given_name: string
              age: number
              needs_kids_supervision?: boolean
              dietary_requirements?: string
            }) => ({
              surname: a.surname,
              given_name: a.given_name,
              age: a.age,
              needs_kids_supervision: a.needs_kids_supervision ?? false,
              dietary_requirements: a.dietary_requirements ?? "",
            })
          ),
          submit: false,
        })
        setBaselineSnapshot(
          JSON.stringify(
            snapshotFromFormValues({
              ...form.getValues(),
            })
          )
        )
      }
    }
    setIsLoading(false)
  }, [user, authFetch, form])

  useEffect(() => {
    if (authLoading) return
    loadRegistration()
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

  const applyApiError = (data: { error?: string; code?: string }) => {
    const message = data.error ?? "Request failed"
    setError(message)
    setEmailInUse(data.code === "EMAIL_IN_USE" || message.includes("already registered"))
    errorBannerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const focusFirstFormError = () => {
    const order: (keyof RegistrationFormData)[] = [
      "surname",
      "given_name",
      "email",
      "mobile",
      "state",
      "accommodation_type",
      "transport_option",
    ]
    const errors = form.formState.errors
    const first = order.find((key) => errors[key])
    if (first) {
      form.setFocus(first)
      return
    }
    errorBannerRef.current?.focus()
  }

  const showValidationError = (message: string) => {
    setError(message)
    errorBannerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    requestAnimationFrame(() => focusFirstFormError())
  }

  const saveAuthenticated = async (submit = false): Promise<boolean> => {
    setError("")
    setEmailInUse(false)
    setSaveAction("submit")
    const values = form.getValues()
    const payload = { ...values, submit, assign_participant_reference: submit }

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
      applyApiError(data)
      setSaveAction(null)
      return false
    }

    const data = await res.json()
    setRegistrationId(data.registration.id)
    if (data.registration.participant_reference) {
      setParticipantReference(data.registration.participant_reference)
    }
    if (data.unchanged) {
      setInfo("No changes to save.")
      setSaveAction(null)
      return true
    }
    if (submit) {
      setSubmitted(true)
      router.push("/my-registration")
    }
    setSaveAction(null)
    return true
  }

  const checkEmailUnique = async (email: string): Promise<boolean> => {
    const params = new URLSearchParams({ email })
    if (registrationId) params.set("excludeId", registrationId)
    const res = await fetch(`/api/registrations/check-email?${params.toString()}`, {
      headers: getAuthHeaders(),
    })
    const data = await res.json()
    if (!res.ok || data.available === false) {
      applyApiError({
        error: data.error ?? EMAIL_IN_USE_FALLBACK,
        code: data.available === false ? "EMAIL_IN_USE" : undefined,
      })
      form.setFocus("email")
      return false
    }
    setEmailInUse(false)
    return true
  }

  const handleEmailBlur = async () => {
    const email = form.getValues("email")?.trim()
    if (!email || !email.includes("@")) return
    setSaveAction("email-check")
    await checkEmailUnique(email)
    setSaveAction(null)
  }

  const submitAsGuest = async (): Promise<boolean> => {
    setError("")
    setEmailInUse(false)
    setSaveAction("submit")
    const values = form.getValues()
    const payload = { ...values, submit: true, assign_participant_reference: true }

    const res = await fetch("/api/registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json()
      applyApiError(data)
      setSaveAction(null)
      return false
    }

    const data = await res.json()
    setSaveAction(null)
    const params = new URLSearchParams()
    if (data.signupToken) params.set("token", data.signupToken)
    if (data.viewToken) params.set("view", data.viewToken)
    router.push(`/register/complete?${params.toString()}`)
    return true
  }

  const handleSubmit = async () => {
    setInfo("")
    const state = form.getValues("state") as string | null | undefined
    const accommodation = form.getValues("accommodation_type") as string | null | undefined
    const transport = form.getValues("transport_option") as string | null | undefined
    let hasLocalError = false

    const arrivalError = transport && (transport === "pickup" || transport === "pickup_dropoff")
      ? getAirportTransportValidationError("pickup", form.getValues("cfca_position"), form.getValues("arrival_date") ?? undefined)
      : null
    const departureError = transport && (transport === "dropoff" || transport === "pickup_dropoff")
      ? getAirportTransportValidationError("dropoff", form.getValues("cfca_position"), form.getValues("departure_date") ?? undefined)
      : null

    if (arrivalError) {
      form.setError("arrival_date", { type: "validate", message: arrivalError })
      hasLocalError = true
    }
    if (departureError) {
      form.setError("departure_date", { type: "validate", message: departureError })
      hasLocalError = true
    }

    if (!state) {
      form.setError("state", {
        type: "required",
        message: "Please select a conference state option",
      })
      hasLocalError = true
    }
    if (!accommodation) {
      form.setError("accommodation_type", {
        type: "required",
        message: "Please select an accommodation option",
      })
      hasLocalError = true
    }
    if (!transport) {
      form.setError("transport_option", {
        type: "required",
        message: "Please select an airport transport option",
      })
      hasLocalError = true
    }
    if (hasLocalError) {
      showValidationError("Please complete accommodation and airport transport before submitting.")
      return
    }

    const valid = await form.trigger()
    if (!valid) {
      showValidationError("Please complete all required fields marked with * before submitting.")
      return
    }

    if (user && submitted && baselineSnapshot) {
      const current = JSON.stringify(snapshotFromFormValues(form.getValues() as Record<string, unknown>))
      if (current === baselineSnapshot) {
        setError("")
        setInfo("No changes to save. Update a field before submitting again.")
        return
      }
    }

    const emailOk = await checkEmailUnique(form.getValues("email"))
    if (!emailOk) return

    if (!user) {
      await submitAsGuest()
      return
    }

    if (submitted && !registrationId) {
      setError("Please log in to edit your registration.")
      return
    }

    const saved = await saveAuthenticated(true)
    if (saved) {
      setBaselineSnapshot(
        JSON.stringify(snapshotFromFormValues(form.getValues() as Record<string, unknown>))
      )
    }
  }

  if (authLoading || (user && isLoading)) {
    return <p className="text-center text-ink-soft">Loading registration...</p>
  }

  return (
    <div className="cfca-page mx-auto max-w-3xl">
      <div className="animate-rise space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-ink">
              Official registration
            </p>
            <h1 className="font-display text-4xl font-semibold text-ink md:text-5xl">
              National Conference
            </h1>
            <div className="accent-rule" aria-hidden />
          </div>
          {!user && (
            <p className="text-base text-ink-soft">
              Already registered?{" "}
              <Link
                href="/login?redirect=/my-registration"
                className="font-semibold text-ink underline-offset-4 hover:underline"
              >
                Login
              </Link>
            </p>
          )}
        </div>
        <p className="max-w-2xl text-base leading-relaxed text-ink-soft md:text-lg">
          Fill in each section below. When you are finished, press{" "}
          <strong className="font-semibold text-ink">
            {submitted ? "Submit Changes" : "Submit Registration"}
          </strong>{" "}
          at the bottom of the page. Fields marked with <strong className="text-ink">*</strong> are
          required.
        </p>
      </div>

      <div ref={errorBannerRef} tabIndex={-1} className="outline-none space-y-3">
        {error && (
          <Alert variant="error">
            {error}
            {emailInUse && (
              <>
                {" "}
                <Link
                  href="/login?redirect=/my-registration"
                  className="font-semibold underline"
                >
                  Login here
                </Link>
              </>
            )}
          </Alert>
        )}
        {info && <Alert variant="info">{info}</Alert>}
      </div>

      {submitted && (
        <Alert variant="success">
          Your registration has been submitted. You can update details below and submit again.
        </Alert>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void handleSubmit()
        }}
        className="space-y-8"
        noValidate
      >
        <fieldset disabled={isBusy} className="m-0 min-w-0 space-y-8 border-0 p-0">
          <Card className="animate-rise-delay-1">
            <CardHeader>
              <SectionHeading
                number={1}
                title="Your details"
                description="Tell us about yourself."
              />
            </CardHeader>
            <CardContent className="grid gap-5 overflow-visible md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="surname" className="text-base">Surname *</Label>
                <Input
                  id="surname"
                  className="h-12 text-base"
                  {...(() => {
                    const field = form.register("surname")
                    return {
                      ...field,
                      onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                        field.onBlur(e)
                        form.trigger("surname")
                      },
                    }
                  })()}
                  aria-label="Surname"
                  aria-required="true"
                  aria-invalid={!!form.formState.errors.surname}
                />
                <FieldError message={form.formState.errors.surname?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="given_name" className="text-base">Name *</Label>
                <Input
                  id="given_name"
                  className="h-12 text-base"
                  {...(() => {
                    const field = form.register("given_name")
                    return {
                      ...field,
                      onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                        field.onBlur(e)
                        form.trigger("given_name")
                      },
                    }
                  })()}
                  aria-label="Given name"
                  aria-required="true"
                  aria-invalid={!!form.formState.errors.given_name}
                />
                <FieldError message={form.formState.errors.given_name?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-base">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  className="h-12 text-base"
                  {...(() => {
                    const emailField = form.register("email")
                    return {
                      ...emailField,
                      onBlur: async (e: React.FocusEvent<HTMLInputElement>) => {
                        await emailField.onBlur(e)
                        await handleEmailBlur()
                      },
                    }
                  })()}
                  aria-label="Email"
                  aria-required="true"
                  aria-invalid={!!form.formState.errors.email || emailInUse}
                  autoComplete="email"
                />
                <FieldError message={form.formState.errors.email?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile" className="text-base">Mobile phone *</Label>
                <Input
                  id="mobile"
                  className="h-12 text-base"
                  {...(() => {
                    const mobileField = form.register("mobile")
                    return {
                      ...mobileField,
                      onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                        mobileField.onBlur(e)
                        form.trigger("mobile")
                      },
                    }
                  })()}
                  aria-label="Mobile phone"
                  aria-required="true"
                  aria-invalid={!!form.formState.errors.mobile}
                  autoComplete="tel"
                  placeholder="e.g. 0412 345 678"
                />
                <FieldError message={form.formState.errors.mobile?.message} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="dietary_requirements" className="text-base">Food allergy and dietary requirements</Label>
                <Input
                  id="dietary_requirements"
                  className="h-12 text-base"
                  {...form.register("dietary_requirements")}
                  aria-label="Food allergy and dietary requirements"
                  placeholder="e.g. nut allergy, vegetarian, halal"
                />
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
                <Label htmlFor="suburb" className="text-base">Suburb</Label>
                <Input id="suburb" className="h-12 text-base" {...form.register("suburb")} aria-label="Suburb" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postcode" className="text-base">Postcode</Label>
                <Input id="postcode" className="h-12 text-base" {...form.register("postcode")} aria-label="Postcode" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_state" className="text-base">Address State</Label>
                <select
                  id="address_state"
                  className={selectClassName}
                  {...form.register("address_state")}
                  aria-label="Address State"
                >
                  <option value="">Select state</option>
                  {AUSTRALIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="state" className="text-base">Conference State *</Label>
                <select
                  id="state"
                  className={selectClassName}
                  {...(() => {
                    const stateField = form.register("state")
                    return {
                      ...stateField,
                      onBlur: (e: React.FocusEvent<HTMLSelectElement>) => {
                        stateField.onBlur(e)
                        form.trigger("state")
                      },
                    }
                  })()}
                  aria-label="Conference State"
                  aria-required="true"
                  aria-invalid={!!form.formState.errors.state}
                >
                  <option value="">Select state</option>
                  {AUSTRALIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <FieldError message={form.formState.errors.state?.message} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="cfca_position" className="text-base">Position in CFCA</Label>
                <select
                  id="cfca_position"
                  className={selectClassName}
                  {...form.register("cfca_position")}
                  aria-label="CFCA position"
                >
                  {CFCA_POSITIONS.map((p) => (
                    <option key={p} value={p}>{CFCA_POSITION_LABELS[p]}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-4 border-t pt-5 md:col-span-2">
                <label className="flex items-start gap-3 text-base">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5"
                    {...form.register("spouse_attending")}
                    aria-label="Spouse is attending"
                  />
                  <span>My spouse is attending</span>
                </label>
                {spouseAttending && (
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-base">Spouse surname *</Label>
                      <Input 
                        className="h-12 text-base" 
                        {...(() => {
                          const field = form.register("spouse_surname")
                          return {
                            ...field,
                            onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                              field.onBlur(e)
                              form.trigger("spouse_surname")
                            },
                          }
                        })()}
                        aria-label="Spouse surname"
                        aria-required="true"
                        aria-invalid={!!form.formState.errors.spouse_surname}
                      />
                      <FieldError message={form.formState.errors.spouse_surname?.message} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-base">Spouse name *</Label>
                      <Input 
                        className="h-12 text-base" 
                        {...(() => {
                          const field = form.register("spouse_given_name")
                          return {
                            ...field,
                            onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                              field.onBlur(e)
                              form.trigger("spouse_given_name")
                            },
                          }
                        })()}
                        aria-label="Spouse given name"
                        aria-required="true"
                        aria-invalid={!!form.formState.errors.spouse_given_name}
                      />
                      <FieldError message={form.formState.errors.spouse_given_name?.message} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-base">Spouse email *</Label>
                      <Input 
                        className="h-12 text-base" 
                        type="email" 
                        {...(() => {
                          const field = form.register("spouse_email")
                          return {
                            ...field,
                            onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                              field.onBlur(e)
                              form.trigger("spouse_email")
                            },
                          }
                        })()}
                        aria-label="Spouse email"
                        aria-required="true"
                        aria-invalid={!!form.formState.errors.spouse_email}
                      />
                      <FieldError message={form.formState.errors.spouse_email?.message} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-base">Spouse mobile *</Label>
                      <Input 
                        className="h-12 text-base" 
                        {...(() => {
                          const spouseMobileField = form.register("spouse_mobile")
                          return {
                            ...spouseMobileField,
                            onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                              spouseMobileField.onBlur(e)
                              form.trigger("spouse_mobile")
                            },
                          }
                        })()}
                        aria-label="Spouse mobile"
                        placeholder="e.g. 0412 345 678"
                        aria-required="true"
                        aria-invalid={!!form.formState.errors.spouse_mobile}
                      />
                      <FieldError message={form.formState.errors.spouse_mobile?.message} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-base">Spouse food allergy and dietary requirements</Label>
                      <Input
                        className="h-12 text-base"
                        {...form.register("spouse_dietary_requirements")}
                        aria-label="Spouse food allergy and dietary requirements"
                        placeholder="e.g. nut allergy, vegetarian, halal"
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="animate-rise-delay-2">
            <CardHeader>
              <SectionHeading
                number={2}
                title="Other people attending"
                description="Optional. Add children or other family members if they are coming with you."
              />
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.length === 0 && (
                <p className="text-base text-ink-soft">
                  No extra attendees yet. Press Add person if someone else is coming with you.
                </p>
              )}
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid gap-4 rounded-md border border-gray-200 bg-gray-50 p-4 md:grid-cols-4"
                >
                  <div className="space-y-2">
                    <Label className="text-base">Surname *</Label>
                    <Input
                      className="h-12 text-base"
                      {...(() => {
                        const field = form.register(`attendees.${index}.surname`)
                        return {
                          ...field,
                          onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                            field.onBlur(e)
                            form.trigger(`attendees.${index}.surname`)
                          },
                        }
                      })()}
                      aria-label={`Attendee ${index + 1} surname`}
                      aria-required="true"
                      aria-invalid={!!form.formState.errors.attendees?.[index]?.surname}
                    />
                    <FieldError message={form.formState.errors.attendees?.[index]?.surname?.message} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base">Name *</Label>
                    <Input
                      className="h-12 text-base"
                      {...(() => {
                        const field = form.register(`attendees.${index}.given_name`)
                        return {
                          ...field,
                          onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                            field.onBlur(e)
                            form.trigger(`attendees.${index}.given_name`)
                          },
                        }
                      })()}
                      aria-label={`Attendee ${index + 1} name`}
                      aria-required="true"
                      aria-invalid={!!form.formState.errors.attendees?.[index]?.given_name}
                    />
                    <FieldError message={form.formState.errors.attendees?.[index]?.given_name?.message} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base">Age *</Label>
                    <Input
                      className="h-12 text-base"
                      type="number"
                      min={0}
                      {...(() => {
                        const field = form.register(`attendees.${index}.age`, { valueAsNumber: true })
                        return {
                          ...field,
                          onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                            field.onBlur(e)
                            form.trigger(`attendees.${index}.age`)
                          },
                        }
                      })()}
                      aria-label={`Attendee ${index + 1} age`}
                      aria-required="true"
                      aria-invalid={!!form.formState.errors.attendees?.[index]?.age}
                    />
                    <FieldError message={form.formState.errors.attendees?.[index]?.age?.message} />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => remove(index)}
                      aria-label={`Remove attendee ${index + 1}`}
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="space-y-2 md:col-span-4">
                    <Label className="text-base">Food allergy &amp; dietary requirements</Label>
                    <Input
                      className="h-12 text-base"
                      {...form.register(`attendees.${index}.dietary_requirements`)}
                      aria-label={`Attendee ${index + 1} food allergy and dietary requirements`}
                      placeholder="e.g. nut allergy, vegetarian, halal"
                    />
                  </div>
                  {(form.watch(`attendees.${index}.age`) ?? 0) < 12 && (
                    <label className="flex items-start gap-3 text-base md:col-span-4">
                      <input
                        type="checkbox"
                        className="mt-1 h-5 w-5"
                        {...form.register(`attendees.${index}.needs_kids_supervision`)}
                        aria-label={`Kids supervision for attendee ${index + 1}`}
                      />
                      <span>Kids supervision required (under 12)</span>
                    </label>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="h-12 text-base"
                onClick={() => append({ surname: "", given_name: "", age: 0, needs_kids_supervision: false, dietary_requirements: "" })}
                aria-label="Add another person attending"
              >
                Add person
              </Button>
            </CardContent>
          </Card>

          <Card className="animate-rise-delay-2">
            <CardHeader>
              <SectionHeading
                number={3}
                title="Accommodation & transport"
                description="Choose how you will stay and travel. Both questions are required."
              />
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="accommodation_type" className="text-base">
                  Accommodation during conference *
                </Label>
                <select
                  id="accommodation_type"
                  className={selectClassName}
                  {...(() => {
                    const field = form.register("accommodation_type")
                    return {
                      ...field,
                      onBlur: (e: React.FocusEvent<HTMLSelectElement>) => {
                        field.onBlur(e)
                        form.trigger("accommodation_type")
                      },
                    }
                  })()}
                  aria-label="Accommodation during conference"
                  aria-required="true"
                  aria-invalid={!!form.formState.errors.accommodation_type}
                >
                  <option value="">Select accommodation option</option>
                  {ACCOMMODATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <FieldError message={form.formState.errors.accommodation_type?.message} />
              </div>

              {accommodationType === "billet" && (
                <Alert variant="info">
                  Accommodation assistance is for Friday to Sunday during the conference, unless
                  you have your own arrangement with fellow brothers and sisters.
                </Alert>
              )}

              {accommodationType === "own" && (
                <Alert variant="info">
                  You chose <strong>self arranged</strong> accommodation — you will organise your
                  own stay.
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="transport_option" className="text-base">
                  Airport transport (Tullamarine) *
                </Label>
                <select
                  id="transport_option"
                  className={selectClassName}
                  {...(() => {
                    const field = form.register("transport_option")
                    return {
                      ...field,
                      onBlur: (e: React.FocusEvent<HTMLSelectElement>) => {
                        field.onBlur(e)
                        form.trigger("transport_option")
                      },
                    }
                  })()}
                  aria-label="Airport transport option"
                  aria-required="true"
                  aria-invalid={!!form.formState.errors.transport_option}
                >
                  <option value="">Select transport option</option>
                  {TRANSPORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <FieldError message={form.formState.errors.transport_option?.message} />
              </div>

              {transportOption && transportOption !== "own" && (
                <TransportScheduleAlert
                  transportOption={transportOption}
                  cfcaPosition={watchAll.cfca_position}
                />
              )}

              {transportOption === "own" && (
                <Alert variant="info">
                  You chose <strong>self arranged</strong> transport — you will organise your own
                  travel to and from the conference.
                </Alert>
              )}

              {needsAirportTransport && (
                <div className="space-y-5 border-t pt-5">
                  {needsAirportTransport && (
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold">Hotel / accommodation for transport</h3>
                      <p className="text-sm text-ink-soft">
                        Optional: if known, share where you are staying so transport coordinators
                        can plan pickup and/or drop-off.
                      </p>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="hotel_name" className="text-base">
                            Hotel / accommodation name
                          </Label>
                          <Input
                            id="hotel_name"
                            className="h-12 text-base"
                            {...form.register("hotel_name")}
                            aria-label="Hotel or accommodation name"
                            placeholder="e.g. Mercure Melbourne"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="hotel_address" className="text-base">
                            Hotel / accommodation address
                          </Label>
                          <Input
                            id="hotel_address"
                            className="h-12 text-base"
                            {...form.register("hotel_address")}
                            aria-label="Hotel or accommodation address"
                            placeholder="Street address"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {showArrival && (
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold">Arrival flight</h3>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label className="text-base">Date of arrival</Label>
                          <Input
                            className="h-12 text-base"
                            type="date"
                            min={pickupDateWindow.min}
                            max={pickupDateWindow.max}
                            {...form.register("arrival_date")}
                            aria-label="Arrival date"
                          />
                          {form.formState.errors.arrival_date && (
                            <FieldError message={form.formState.errors.arrival_date?.message} />
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="text-base">Airport</Label>
                          <Input className="h-12 text-base" {...form.register("arrival_airport")} aria-label="Arrival airport" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-base">Flight number</Label>
                          <Input className="h-12 text-base" {...form.register("arrival_flight_no")} aria-label="Arrival flight number" />
                        </div>
                      </div>
                    </div>
                  )}

                  {showDeparture && (
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold">Departure flight</h3>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label className="text-base">Date of departure</Label>
                          <Input
                            className="h-12 text-base"
                            type="date"
                            min={dropoffDateWindow.min}
                            max={dropoffDateWindow.max}
                            {...form.register("departure_date")}
                            aria-label="Departure date"
                          />
                          {form.formState.errors.departure_date && (
                            <FieldError message={form.formState.errors.departure_date?.message} />
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="text-base">Airport</Label>
                          <Input className="h-12 text-base" {...form.register("departure_airport")} aria-label="Departure airport" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-base">Flight number</Label>
                          <Input className="h-12 text-base" {...form.register("departure_flight_no")} aria-label="Departure flight number" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="animate-rise-delay-3">
            <CardHeader>
              <SectionHeading
                number={4}
                title="Souvenir pre-order (optional)"
                description="Pre-order conference t-shirts if you would like. You can skip this section."
              />
            </CardHeader>
            <CardContent className="space-y-5">
              <Alert variant="info">
                Souvenirs are managed by <strong>Love In Action</strong>. All proceeds go into the
                fund to help future projects in sharing the love and help to other people.
              </Alert>
              <p className="text-base text-ink-soft">
                Conference t-shirt — <strong className="text-ink">{formatCurrency(TSHIRT_UNIT_PRICE)}</strong> each.
                Enter how many you want for each size (leave as 0 if you do not want that size).
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {TSHIRT_SIZES.map((size, index) => (
                  <div key={size} className="space-y-2 rounded-md border border-gray-200 p-4">
                    <input
                      type="hidden"
                      {...form.register(`souvenir_orders.${index}.size`)}
                      defaultValue={size}
                    />
                    <Label htmlFor={`souvenir-${size}`} className="text-base">
                      {TSHIRT_SIZE_LABELS[size]}
                    </Label>
                    <Input
                      id={`souvenir-${size}`}
                      type="number"
                      min={0}
                      max={50}
                      className="h-12 text-base"
                      {...form.register(`souvenir_orders.${index}.quantity`, {
                        valueAsNumber: true,
                      })}
                      aria-label={`Quantity for ${TSHIRT_SIZE_LABELS[size]} t-shirts`}
                    />
                  </div>
                ))}
              </div>
              {souvenirQty > 0 && (
                <p className="text-base font-medium text-ink">
                  Pre-order: {formatSouvenirOrdersSummary(watchAll.souvenir_orders)} —{" "}
                  {formatCurrency(souvenirAmount)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="animate-rise-delay-3">
            <CardHeader>
              <SectionHeading
                number={5}
                title="Review & submit"
                description="Check your answers, then submit. You can scroll up to change anything."
              />
            </CardHeader>
            <CardContent className="space-y-6">
              <RegistrationReviewSummary
                formData={watchAll as RegistrationFormData}
                participantReference={participantReference}
              />
              <div className="rounded-md border border-[color:rgba(166,135,78,0.35)] bg-[rgba(166,135,78,0.1)] p-4 text-base text-accent-ink">
                When you are ready, press the button below. You only need to do this once.
              </div>
              <Button
                type="submit"
                className="h-14 w-full text-lg"
                isLoading={saveAction === "submit"}
                loadingText={submitted ? "Submitting changes..." : "Submitting..."}
                disabled={isBusy}
                aria-label={submitted ? "Submit changes" : "Submit registration"}
              >
                {submitted ? "Submit Changes" : "Submit Registration"}
              </Button>
            </CardContent>
          </Card>
        </fieldset>
      </form>
    </div>
  )
}

export default RegistrationForm
