export const TRANSPORT_OPTIONS = [
  { value: "own", label: "No, I'll organize my own transportation" },
  { value: "pickup", label: "Need Pickup from Tullamarine Airport" },
  { value: "dropoff", label: "Need Drop-off to Tullamarine Airport" },
  { value: "pickup_dropoff", label: "Need Pick-up and Drop-off Tullamarine Airport" },
] as const

export type TransportOption = (typeof TRANSPORT_OPTIONS)[number]["value"]

export const ACCOMMODATION_OPTIONS = [
  { value: "own", label: "No, I'll organise my own accommodation" },
  { value: "billet", label: "Yes, I need accommodation assistance" },
] as const

export const transportOptionToBooleans = (option: TransportOption | "" | null | undefined) => {
  if (!option || option === "own") {
    return {
      pickup_melbourne_airport: false,
      dropoff_melbourne_airport: false,
      hotel_transport_required: false,
    }
  }
  return {
    pickup_melbourne_airport: option === "pickup" || option === "pickup_dropoff",
    dropoff_melbourne_airport: option === "dropoff" || option === "pickup_dropoff",
    hotel_transport_required: false,
  }
}

export const booleansToTransportOption = (
  pickup?: boolean | null,
  dropoff?: boolean | null
): TransportOption => {
  if (pickup && dropoff) return "pickup_dropoff"
  if (pickup) return "pickup"
  if (dropoff) return "dropoff"
  return "own"
}

export const getTransportOptionLabel = (option: TransportOption | "" | null | undefined) =>
  TRANSPORT_OPTIONS.find((o) => o.value === (option || "own"))?.label ?? ""

export const getAccommodationLabel = (type: string | null | undefined) => {
  if (type === "billet") return "Accommodation assistance requested"
  if (type === "own") return "Self arranged"
  return ""
}

export const getTransportFlightSections = (option: TransportOption | "" | null | undefined) => ({
  showArrival: option === "pickup" || option === "pickup_dropoff",
  showDeparture: option === "dropoff" || option === "pickup_dropoff",
})
