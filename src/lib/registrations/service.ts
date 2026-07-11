import { createAdminClient } from "@/lib/supabase/admin"
import { getRegistrationCodePrefix } from "@/lib/supabase/env"
import { calculateTotal, isEarlyBirdWindow, type AttendeeInput } from "@/lib/pricing/calculate"
import type { RegistrationFormData } from "./schema"
import { transportOptionToBooleans } from "./transport"

export const buildAttendeesForPricing = (data: RegistrationFormData): AttendeeInput[] => {
  const attendees: AttendeeInput[] = [{ age: 18, isPrimary: true }]
  if (data.spouse_attending) attendees.push({ age: 18, isSpouse: true })
  for (const a of data.attendees) attendees.push({ age: a.age })
  return attendees
}

export const computeAmountDue = (
  data: RegistrationFormData,
  earlyBirdSlot: "interstate" | "melbourne" | "none"
) => calculateTotal({ attendees: buildAttendeesForPricing(data), earlyBirdSlot })

export const claimEarlyBirdSlot = async (
  state: string
): Promise<"interstate" | "melbourne" | "none"> => {
  if (!isEarlyBirdWindow()) return "none"

  const admin = createAdminClient()
  const { data, error } = await admin.rpc("claim_early_bird_slot", {
    p_state: state,
  })

  if (error) return "none"
  return (data as "interstate" | "melbourne" | "none") ?? "none"
}

export const generateRegistrationNo = async () => {
  const admin = createAdminClient()
  const prefix = getRegistrationCodePrefix()
  const { data, error } = await admin.rpc("generate_registration_no", { prefix })
  if (error) throw new Error(error.message)
  return data as string
}

export const mapFormToDb = (data: RegistrationFormData, extras: {
  registration_no?: string
  user_id: string | null
  amount_due: number
  early_bird_slot: string
  is_early_bird: boolean
  submitted_at?: string | null
}) => {
  const transport =
    data.transport_option !== undefined && data.transport_option !== null && data.transport_option !== ""
      ? transportOptionToBooleans(data.transport_option as Parameters<typeof transportOptionToBooleans>[0])
      : transportOptionToBooleans("own")

  const needsAssistance = data.accommodation_type === "billet"

  return {
  ...extras,
  surname: data.surname,
  given_name: data.given_name,
  email: data.email,
  mobile: data.mobile,
  address_line1: data.address_line1 ?? "",
  suburb: data.suburb ?? "",
  address_state: data.address_state === "" ? null : (data.address_state ?? null),
  postcode: data.postcode ?? "",
  cfca_position: data.cfca_position ?? "member",
  state: data.state,
  spouse_surname: data.spouse_surname ?? "",
  spouse_given_name: data.spouse_given_name ?? "",
  spouse_attending: data.spouse_attending,
  spouse_email: data.spouse_email ?? "",
  spouse_mobile: data.spouse_mobile ?? "",
  accommodation_type: data.accommodation_type === "" || data.accommodation_type == null
    ? null
    : data.accommodation_type,
  pickup_melbourne_airport: transport.pickup_melbourne_airport,
  dropoff_melbourne_airport: transport.dropoff_melbourne_airport,
  hotel_transport_required: transport.hotel_transport_required,
  arrival_date: data.arrival_date || null,
  arrival_airport: data.arrival_airport ?? "",
  arrival_flight_no: data.arrival_flight_no ?? "",
  departure_date: data.departure_date || null,
  departure_airport: data.departure_airport ?? "",
  departure_flight_no: data.departure_flight_no ?? "",
  hotel_name: needsAssistance ? "" : (data.hotel_name ?? ""),
  hotel_address: needsAssistance ? "" : (data.hotel_address ?? ""),
  accommodation_contact_name: data.accommodation_contact_name ?? "",
  accommodation_contact_phone: data.accommodation_contact_phone ?? "",
  updated_at: new Date().toISOString(),
  }
}

export const getRegistrationWithAttendees = async (id: string) => {
  const admin = createAdminClient()
  const { data: registration, error } = await admin
    .from("registrations")
    .select("*")
    .eq("id", id)
    .single()

  if (error) return null

  const { data: attendees } = await admin
    .from("registration_attendees")
    .select("*")
    .eq("registration_id", id)
    .order("sort_order")

  return {
    ...registration,
    attendees: attendees ?? [],
    registration_attendees: attendees ?? [],
  }
}
