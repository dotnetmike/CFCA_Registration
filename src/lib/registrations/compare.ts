import { transportOptionToBooleans, type TransportOption } from "./transport"
import { normalizeSouvenirOrders } from "./souvenirs"

export type ComparableAttendee = {
  surname: string
  given_name: string
  age: number
  needs_kids_supervision: boolean
  dietary_requirements: string
}

export type ComparableRegistrationSnapshot = {
  surname: string
  given_name: string
  email: string
  mobile: string
  dietary_requirements: string
  address_line1: string
  suburb: string
  address_state: string
  postcode: string
  ministry: string
  cfca_position: string
  elder_assembly_attending: boolean
  state: string
  spouse_surname: string
  spouse_given_name: string
  spouse_attending: boolean
  spouse_email: string
  spouse_mobile: string
  spouse_dietary_requirements: string
  accommodation_type: string
  pickup_melbourne_airport: boolean
  dropoff_melbourne_airport: boolean
  arrival_date: string
  arrival_airport: string
  arrival_flight_no: string
  departure_date: string
  departure_airport: string
  departure_flight_no: string
  hotel_name: string
  hotel_address: string
  accommodation_contact_name: string
  accommodation_contact_phone: string
  pickup_transport_contact_name: string
  pickup_transport_contact_phone: string
  dropoff_transport_contact_name: string
  dropoff_transport_contact_phone: string
  souvenir_orders: { size: string; quantity: number }[]
  attendees: ComparableAttendee[]
}

const str = (value: unknown) => String(value ?? "").trim()
const dateStr = (value: unknown) => {
  const raw = str(value)
  return raw ? raw.slice(0, 10) : ""
}

export const normalizeComparableAttendees = (
  attendees: unknown
): ComparableAttendee[] => {
  if (!Array.isArray(attendees)) return []
  return attendees.map((row) => {
    const a = row as Record<string, unknown>
    const age = Number(a.age ?? 0)
    return {
      surname: str(a.surname),
      given_name: str(a.given_name),
      age: Number.isFinite(age) ? age : 0,
      needs_kids_supervision: age < 12 ? !!a.needs_kids_supervision : false,
      dietary_requirements: str(a.dietary_requirements),
    }
  })
}

export const snapshotFromFormValues = (
  values: Record<string, unknown>
): ComparableRegistrationSnapshot => {
  const transportOption = values.transport_option as TransportOption | "" | null | undefined
  const transport =
    transportOption !== undefined && transportOption !== null && transportOption !== ""
      ? transportOptionToBooleans(transportOption)
      : {
          pickup_melbourne_airport: !!values.pickup_melbourne_airport,
          dropoff_melbourne_airport: !!values.dropoff_melbourne_airport,
          hotel_transport_required: false,
        }

  return {
    surname: str(values.surname),
    given_name: str(values.given_name),
    email: str(values.email).toLowerCase(),
    mobile: str(values.mobile),
    dietary_requirements: str(values.dietary_requirements),
    address_line1: str(values.address_line1),
    suburb: str(values.suburb),
    address_state: str(values.address_state),
    postcode: str(values.postcode),
    ministry: str(values.ministry) || "cfca",
    cfca_position: str(values.cfca_position) || "member",
    elder_assembly_attending: !!values.elder_assembly_attending,
    state: str(values.state),
    spouse_surname: str(values.spouse_surname),
    spouse_given_name: str(values.spouse_given_name),
    spouse_attending: !!values.spouse_attending,
    spouse_email: str(values.spouse_email).toLowerCase(),
    spouse_mobile: str(values.spouse_mobile),
    spouse_dietary_requirements: str(values.spouse_dietary_requirements),
    accommodation_type: str(values.accommodation_type),
    pickup_melbourne_airport: !!transport.pickup_melbourne_airport,
    dropoff_melbourne_airport: !!transport.dropoff_melbourne_airport,
    arrival_date: dateStr(values.arrival_date),
    arrival_airport: str(values.arrival_airport),
    arrival_flight_no: str(values.arrival_flight_no),
    departure_date: dateStr(values.departure_date),
    departure_airport: str(values.departure_airport),
    departure_flight_no: str(values.departure_flight_no),
    hotel_name: str(values.hotel_name),
    hotel_address: str(values.hotel_address),
    accommodation_contact_name: str(values.accommodation_contact_name),
    accommodation_contact_phone: str(values.accommodation_contact_phone),
    pickup_transport_contact_name: str(values.pickup_transport_contact_name),
    pickup_transport_contact_phone: str(values.pickup_transport_contact_phone),
    dropoff_transport_contact_name: str(values.dropoff_transport_contact_name),
    dropoff_transport_contact_phone: str(values.dropoff_transport_contact_phone),
    souvenir_orders: normalizeSouvenirOrders(values.souvenir_orders),
    attendees: normalizeComparableAttendees(values.attendees),
  }
}

export const snapshotFromRegistration = (
  reg: Record<string, unknown>,
  attendees?: unknown
): ComparableRegistrationSnapshot => {
  const list =
    attendees ??
    reg.registration_attendees ??
    reg.attendees ??
    []

  return {
    surname: str(reg.surname),
    given_name: str(reg.given_name),
    email: str(reg.email).toLowerCase(),
    mobile: str(reg.mobile),
    dietary_requirements: str(reg.dietary_requirements),
    address_line1: str(reg.address_line1),
    suburb: str(reg.suburb),
    address_state: str(reg.address_state),
    postcode: str(reg.postcode),
    ministry: str(reg.ministry) || "cfca",
    cfca_position: str(reg.cfca_position) || "member",
    elder_assembly_attending: !!reg.elder_assembly_attending,
    state: str(reg.state),
    spouse_surname: str(reg.spouse_surname),
    spouse_given_name: str(reg.spouse_given_name),
    spouse_attending: !!reg.spouse_attending,
    spouse_email: str(reg.spouse_email).toLowerCase(),
    spouse_mobile: str(reg.spouse_mobile),
    spouse_dietary_requirements: str(reg.spouse_dietary_requirements),
    accommodation_type: str(reg.accommodation_type),
    pickup_melbourne_airport: !!reg.pickup_melbourne_airport,
    dropoff_melbourne_airport: !!reg.dropoff_melbourne_airport,
    arrival_date: dateStr(reg.arrival_date),
    arrival_airport: str(reg.arrival_airport),
    arrival_flight_no: str(reg.arrival_flight_no),
    departure_date: dateStr(reg.departure_date),
    departure_airport: str(reg.departure_airport),
    departure_flight_no: str(reg.departure_flight_no),
    hotel_name: str(reg.hotel_name),
    hotel_address: str(reg.hotel_address),
    accommodation_contact_name: str(reg.accommodation_contact_name),
    accommodation_contact_phone: str(reg.accommodation_contact_phone),
    pickup_transport_contact_name: str(reg.pickup_transport_contact_name),
    pickup_transport_contact_phone: str(reg.pickup_transport_contact_phone),
    dropoff_transport_contact_name: str(reg.dropoff_transport_contact_name),
    dropoff_transport_contact_phone: str(reg.dropoff_transport_contact_phone),
    souvenir_orders: normalizeSouvenirOrders(reg.souvenir_orders),
    attendees: normalizeComparableAttendees(list),
  }
}

export const hasRegistrationChanges = (
  before: ComparableRegistrationSnapshot,
  after: ComparableRegistrationSnapshot
) => JSON.stringify(before) !== JSON.stringify(after)
