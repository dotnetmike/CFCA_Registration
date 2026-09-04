import { z } from "zod"

export const CFCA_POSITIONS = [
  "member",
  "non_member",
  "hh_leader",
  "unit_leader",
  "chapter_leader",
  "ministry_coordinator",
  "area_coordinator",
  "area_head",
  "national_council",
] as const

export const MINISTRIES = [
  "cfca",
  "hold",
  "sold",
  "lia",
  "family_ministry",
  "non_member",
] as const

export const AUSTRALIAN_STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"] as const

export const CFCA_POSITION_LABELS: Record<(typeof CFCA_POSITIONS)[number], string> = {
  member: "Member",
  non_member: "Non-member",
  hh_leader: "HH Leader",
  unit_leader: "Unit Leader",
  chapter_leader: "Chapter Leader",
  ministry_coordinator: "Ministry Coordinator",
  area_coordinator: "Area Coordinator",
  area_head: "Area Head",
  national_council: "National Council",
}

export const MINISTRY_LABELS: Record<(typeof MINISTRIES)[number], string> = {
  cfca: "CFCA",
  hold: "HOLD",
  sold: "SOLD",
  lia: "LIA",
  family_ministry: "Family Ministry",
  non_member: "Non-member",
}

export const ELDER_ASSEMBLY_POSITIONS = [
  "chapter_leader",
  "ministry_coordinator",
  "area_coordinator",
  "area_head",
  "national_council",
] as const

export const CONFERENCE_DATE_RANGE = {
  start: "2027-04-09",
  end: "2027-04-11",
} as const

export const isAustralianMobileNumber = (value: string) => {
  const digits = value.replace(/[\s()\-]/g, "").trim()
  if (!digits) return false
  if (!/^\+?[0-9]+$/.test(digits)) return false
  const normalized = digits.startsWith("+") ? digits.slice(1) : digits
  return /^(?:0|61)?4\d{8}$/.test(normalized)
}

export const getAirportTransportDateWindow = (
  transportType: "pickup" | "dropoff",
  position: string | null | undefined
) => {
  void position
  if (transportType === "pickup") {
    return { min: "2027-04-08", max: "2027-04-10" }
  }

  return { min: "2027-04-10", max: "2027-04-11" }
}

export const getAirportTransportValidationError = (
  transportType: "pickup" | "dropoff",
  position: string | null | undefined,
  selectedDate: string | null | undefined
) => {
  if (!selectedDate) return null

  const window = getAirportTransportDateWindow(transportType, position)
  if (selectedDate < window.min || selectedDate > window.max) {
    if (transportType === "pickup") {
      return "Please choose a pickup date between Thursday, 8 April 2027 and Saturday, 10 April 2027."
    }
    return "Please choose a drop-off date between Saturday, 10 April 2027 and Sunday, 11 April 2027."
  }

  return null
}

const emptyableState = z.union([z.enum(AUSTRALIAN_STATES), z.literal(""), z.null()]).optional()
const emptyableAccommodation = z.union([z.enum(["own", "billet"]), z.literal(""), z.null()]).optional()
const emptyableTransport = z
  .union([z.enum(["own", "pickup", "dropoff", "pickup_dropoff"]), z.literal(""), z.null()])
  .optional()

const optionalString = z.union([z.string(), z.null()]).optional()
const optionalBoolean = z.union([z.boolean(), z.null()]).optional()
const optionalEmail = z.union([z.string().email("Valid email required"), z.literal(""), z.null()]).optional()

export const attendeeSchema = z.object({
  surname: z.string().min(1, "Surname is required"),
  given_name: z.string().min(1, "Name is required"),
  age: z.coerce.number({ invalid_type_error: "Age is required" }).min(0, "Age is required").max(120),
  needs_kids_supervision: z.boolean().optional(),
  dietary_requirements: z.string().optional(),
})

export const souvenirOrderLineSchema = z.object({
  size: z.enum(["S", "M", "L", "XL", "2XL"]),
  quantity: z.preprocess(
    (value) => {
      if (value === "" || value == null) return 0
      const n = Number(value)
      return Number.isFinite(n) ? n : 0
    },
    z.number().int().min(0).max(50)
  ),
})

export const registrationBaseSchema = z.object({
  surname: z.string().min(1, "Surname is required"),
  given_name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  mobile: z
    .string()
    .trim()
    .min(1, "Mobile is required")
    .refine((value) => isAustralianMobileNumber(value), {
      message: "Mobile number must be a valid Australian mobile number",
    }),
  dietary_requirements: optionalString,
  address_line1: optionalString,
  suburb: optionalString,
  address_state: emptyableState,
  postcode: optionalString,
  ministry: z.enum(MINISTRIES).default("cfca"),
  cfca_position: z.enum(CFCA_POSITIONS).default("member"),
  elder_assembly_attending: z.boolean().default(false),
  state: emptyableState,
  spouse_surname: optionalString,
  spouse_given_name: optionalString,
  spouse_attending: z.boolean(),
  spouse_email: optionalEmail,
  spouse_mobile: z
    .union([z.string().trim(), z.literal(""), z.null()])
    .optional()
    .refine(
      (value) => !value || value === "" || isAustralianMobileNumber(value),
      { message: "Spouse mobile number must be a valid Australian mobile number" }
    ),
  spouse_dietary_requirements: optionalString,
  accommodation_type: emptyableAccommodation,
  transport_option: emptyableTransport,
  pickup_melbourne_airport: optionalBoolean,
  dropoff_melbourne_airport: optionalBoolean,
  hotel_transport_required: optionalBoolean,
  arrival_date: optionalString,
  arrival_airport: optionalString,
  arrival_flight_no: optionalString,
  departure_date: optionalString,
  departure_airport: optionalString,
  departure_flight_no: optionalString,
  hotel_name: optionalString,
  hotel_address: optionalString,
  accommodation_contact_name: optionalString,
  accommodation_contact_phone: optionalString,
  pickup_transport_contact_name: optionalString,
  pickup_transport_contact_phone: optionalString,
  dropoff_transport_contact_name: optionalString,
  dropoff_transport_contact_phone: optionalString,
  souvenir_orders: z.array(souvenirOrderLineSchema).optional().default([]),
  attendees: z.array(attendeeSchema),
  submit: z.boolean(),
})

export const registrationSchema = registrationBaseSchema.superRefine((data, ctx) => {
  if (data.ministry === "non_member" && data.cfca_position !== "non_member") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Ministry Role must be Non-member when Ministry is Non-member",
      path: ["cfca_position"],
    })
  }

  // Spouse and attendee fields validate live (like surname/mobile), not gated by submit.
  if (data.spouse_attending) {
    if (!data.spouse_surname || !data.spouse_surname.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Spouse surname is required",
        path: ["spouse_surname"],
      })
    }
    if (!data.spouse_given_name || !data.spouse_given_name.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Spouse name is required",
        path: ["spouse_given_name"],
      })
    }
    if (!data.spouse_email || !data.spouse_email.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Spouse email is required",
        path: ["spouse_email"],
      })
    }
    if (!data.spouse_mobile || !data.spouse_mobile.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Spouse mobile is required",
        path: ["spouse_mobile"],
      })
    }
  }

  if (data.attendees && data.attendees.length > 0) {
    for (let i = 0; i < data.attendees.length; i++) {
      const attendee = data.attendees[i]
      if (!attendee.surname || !attendee.surname.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Surname is required",
          path: [`attendees.${i}.surname`],
        })
      }
      if (!attendee.given_name || !attendee.given_name.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Name is required",
          path: [`attendees.${i}.given_name`],
        })
      }
      if (attendee.age == null || attendee.age < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Age is required",
          path: [`attendees.${i}.age`],
        })
      }
    }
  }

  if (!data.submit) return

  const state = data.state as string | null | undefined
  if (!state) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please complete all required fields marked with * before submitting.",
      path: ["state"],
    })
  }

  const accommodation = data.accommodation_type as string | null | undefined
  if (!accommodation) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please complete all required fields marked with * before submitting.",
      path: ["accommodation_type"],
    })
  }

  const transport = data.transport_option as string | null | undefined
  if (!transport) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please complete all required fields marked with * before submitting.",
      path: ["transport_option"],
    })
  }

  if (transport === "pickup" || transport === "pickup_dropoff") {
    const pickupError = getAirportTransportValidationError(
      "pickup",
      data.cfca_position,
      data.arrival_date ?? undefined
    )
    if (pickupError) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: pickupError,
        path: ["arrival_date"],
      })
    }
  }

  if (transport === "dropoff" || transport === "pickup_dropoff") {
    const dropoffError = getAirportTransportValidationError(
      "dropoff",
      data.cfca_position,
      data.departure_date ?? undefined
    )
    if (dropoffError) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: dropoffError,
        path: ["departure_date"],
      })
    }
  }
})

export const formatRegistrationSchemaError = (error: z.ZodError) => {
  const issue = error.errors[0]
  if (!issue) return "Invalid data"
  const field = issue.path.length ? issue.path.join(".") : "form"
  if (issue.message === "Invalid input" || issue.message === "Required") {
    return `Invalid value for ${field}`
  }
  return field === "form" ? issue.message : `${field}: ${issue.message}`
}

export type RegistrationFormData = z.infer<typeof registrationSchema>
export type RegistrationFormInput = z.input<typeof registrationSchema>

export const accommodationOnlySchema = z.object({
  accommodation_type: z.enum(["own", "billet"]).optional(),
  pickup_melbourne_airport: z.boolean().optional(),
  dropoff_melbourne_airport: z.boolean().optional(),
  hotel_transport_required: z.boolean().optional(),
  arrival_date: z.string().optional(),
  arrival_airport: z.string().optional(),
  arrival_flight_no: z.string().optional(),
  departure_date: z.string().optional(),
  departure_airport: z.string().optional(),
  departure_flight_no: z.string().optional(),
  hotel_name: z.string().optional(),
  hotel_address: z.string().optional(),
  accommodation_contact_name: z.string().optional(),
  accommodation_contact_phone: z.string().optional(),
  pickup_transport_contact_name: z.string().optional(),
  pickup_transport_contact_phone: z.string().optional(),
  dropoff_transport_contact_name: z.string().optional(),
  dropoff_transport_contact_phone: z.string().optional(),
})

export const REGISTRATION_FIELDS = {
  registration: [
    "surname", "given_name", "email", "mobile", "dietary_requirements", "address_line1",
    "suburb", "address_state", "postcode", "ministry", "cfca_position", "elder_assembly_attending", "state",
    "spouse_surname", "spouse_given_name", "spouse_attending", "spouse_email", "spouse_mobile",
    "spouse_dietary_requirements", "souvenir_orders",
  ],
  accommodation: [
    "accommodation_type", "pickup_melbourne_airport", "dropoff_melbourne_airport",
    "hotel_transport_required", "arrival_date", "arrival_airport", "arrival_flight_no",
    "departure_date", "departure_airport", "departure_flight_no",
    "hotel_name", "hotel_address", "accommodation_contact_name", "accommodation_contact_phone",
    "pickup_transport_contact_name", "pickup_transport_contact_phone",
    "dropoff_transport_contact_name", "dropoff_transport_contact_phone",
  ],
} as const
