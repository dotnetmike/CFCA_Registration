import { z } from "zod"

export const CFCA_POSITIONS = [
  "member",
  "hh_leader",
  "unit_leader",
  "chapter_leader",
  "ministry_coordinator",
  "area_coordinator",
  "area_head",
  "national_council",
] as const

export const AUSTRALIAN_STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"] as const

export const CFCA_POSITION_LABELS: Record<(typeof CFCA_POSITIONS)[number], string> = {
  member: "Member",
  hh_leader: "HH Leader",
  unit_leader: "Unit Leader",
  chapter_leader: "Chapter Leader",
  ministry_coordinator: "Ministry Coordinator",
  area_coordinator: "Area Coordinator",
  area_head: "Area Head",
  national_council: "National Council",
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
  surname: z.string().min(1),
  given_name: z.string().min(1),
  age: z.coerce.number().min(0).max(120),
  needs_kids_supervision: z.boolean().optional(),
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
  mobile: z.string().min(1, "Mobile is required"),
  address_line1: optionalString,
  suburb: optionalString,
  address_state: emptyableState,
  postcode: optionalString,
  cfca_position: z.enum(CFCA_POSITIONS).default("member"),
  state: z.enum(AUSTRALIAN_STATES, { required_error: "Conference state is required" }),
  spouse_surname: optionalString,
  spouse_given_name: optionalString,
  spouse_attending: z.boolean(),
  spouse_email: optionalEmail,
  spouse_mobile: optionalString,
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
  if (!data.submit) return

  const accommodation = data.accommodation_type as string | null | undefined
  if (!accommodation) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please select an accommodation option",
      path: ["accommodation_type"],
    })
  }

  const transport = data.transport_option as string | null | undefined
  if (!transport) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please select an airport transport option",
      path: ["transport_option"],
    })
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
    "surname", "given_name", "email", "mobile", "address_line1",
    "suburb", "address_state", "postcode", "cfca_position", "state",
    "spouse_surname", "spouse_given_name", "spouse_attending", "spouse_email", "spouse_mobile",
    "souvenir_orders",
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
