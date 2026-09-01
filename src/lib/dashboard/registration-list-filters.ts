import { souvenirTotalQuantity } from "@/lib/registrations/souvenirs"
import { booleansToTransportOption } from "@/lib/registrations/transport"

export type RegistrationListFilterState = {
  search: string
  paymentFilter: string
  accommodationFilter: string
  transpoFilter: string
  stateFilter: string
  souvenirFilter: string
}

export type RegistrationListFilterRow = {
  registration_no?: string | null
  surname?: string | null
  given_name?: string | null
  email?: string | null
  state?: string | null
  payment_status?: string | null
  accommodation_type?: string | null
  pickup_melbourne_airport?: boolean | null
  dropoff_melbourne_airport?: boolean | null
  accommodation_contact_name?: string | null
  pickup_transport_contact_name?: string | null
  dropoff_transport_contact_name?: string | null
  souvenir_orders?: unknown
  souvenir_quantity?: number
}

const souvenirQty = (row: RegistrationListFilterRow) =>
  row.souvenir_quantity ?? souvenirTotalQuantity(row.souvenir_orders)

export const matchesRegistrationListFilters = (
  row: RegistrationListFilterRow,
  filters: RegistrationListFilterState
) => {
  const q = filters.search.trim().toLowerCase()
  const matchesSearch =
    !q ||
    row.registration_no?.toLowerCase().includes(q) ||
    row.surname?.toLowerCase().includes(q) ||
    row.given_name?.toLowerCase().includes(q) ||
    row.email?.toLowerCase().includes(q) ||
    row.state?.toLowerCase().includes(q) ||
    row.accommodation_contact_name?.toLowerCase().includes(q) ||
    row.pickup_transport_contact_name?.toLowerCase().includes(q) ||
    row.dropoff_transport_contact_name?.toLowerCase().includes(q)

  if (!matchesSearch) return false
  if (filters.paymentFilter && row.payment_status !== filters.paymentFilter) return false
  if (filters.accommodationFilter === "yes" && row.accommodation_type !== "billet") return false
  if (filters.accommodationFilter === "no" && row.accommodation_type !== "own") return false

  if (filters.transpoFilter) {
    const option = booleansToTransportOption(
      row.pickup_melbourne_airport,
      row.dropoff_melbourne_airport
    )
    if (filters.transpoFilter === "none" && option !== "own") return false
    if (filters.transpoFilter === "pickup" && option !== "pickup") return false
    if (filters.transpoFilter === "dropoff" && option !== "dropoff") return false
    if (filters.transpoFilter === "both" && option !== "pickup_dropoff") return false
  }

  if (filters.stateFilter && row.state !== filters.stateFilter) return false

  const qty = souvenirQty(row)
  if (filters.souvenirFilter === "yes" && !(qty > 0)) return false
  if (filters.souvenirFilter === "no" && qty > 0) return false

  return true
}

export const filterRegistrationList = <T extends RegistrationListFilterRow>(
  rows: T[],
  filters: RegistrationListFilterState
) => rows.filter((row) => matchesRegistrationListFilters(row, filters))
