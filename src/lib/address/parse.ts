export type AustralianStateCode = "NSW" | "VIC" | "QLD" | "SA" | "WA" | "TAS" | "NT" | "ACT"

export type AustralianAddress = {
  address_line1: string
  address_line2: string
  suburb: string
  address_state: AustralianStateCode | ""
  postcode: string
  label: string
}

const STATE_NAME_TO_CODE: Record<string, AustralianStateCode> = {
  "new south wales": "NSW",
  nsw: "NSW",
  victoria: "VIC",
  vic: "VIC",
  queensland: "QLD",
  qld: "QLD",
  "south australia": "SA",
  sa: "SA",
  "western australia": "WA",
  wa: "WA",
  tasmania: "TAS",
  tas: "TAS",
  "northern territory": "NT",
  nt: "NT",
  "australian capital territory": "ACT",
  act: "ACT",
}

export const normalizeAustralianState = (value: string | undefined): AustralianStateCode | "" => {
  if (!value) return ""
  const key = value.trim().toLowerCase()
  if (STATE_NAME_TO_CODE[key]) return STATE_NAME_TO_CODE[key]
  const upper = value.toUpperCase()
  if (["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"].includes(upper)) {
    return upper as AustralianStateCode
  }
  return ""
}

export const parseNominatimResult = (item: {
  display_name: string
  address?: Record<string, string>
}): AustralianAddress | null => {
  const addr = item.address
  if (!addr) return null

  const houseNumber = addr.house_number ?? ""
  const road = addr.road ?? addr.pedestrian ?? addr.footway ?? ""
  const line1 = [houseNumber, road].filter(Boolean).join(" ").trim()
  const suburb =
    addr.suburb ?? addr.town ?? addr.city ?? addr.village ?? addr.hamlet ?? addr.locality ?? ""
  const postcode = addr.postcode ?? ""
  const state = normalizeAustralianState(addr.state)

  if (!line1 && !suburb) return null

  return {
    address_line1: line1,
    address_line2: addr.unit ?? addr.level ?? "",
    suburb,
    address_state: state,
    postcode,
    label: item.display_name,
  }
}

export const parseGooglePlaceDetails = (result: {
  formatted_address?: string
  address_components?: { long_name: string; short_name: string; types: string[] }[]
}): AustralianAddress | null => {
  const components = result.address_components ?? []
  const get = (type: string, useShort = false) => {
    const match = components.find((c) => c.types.includes(type))
    return useShort ? match?.short_name ?? "" : match?.long_name ?? ""
  }

  const streetNumber = get("street_number")
  const route = get("route")
  const line1 = [streetNumber, route].filter(Boolean).join(" ").trim()
  const suburb =
    get("locality") || get("sublocality") || get("postal_town") || get("administrative_area_level_2")
  const postcode = get("postal_code")
  const state = normalizeAustralianState(get("administrative_area_level_1", true))

  if (!line1 && !suburb) return null

  return {
    address_line1: line1,
    address_line2: get("subpremise"),
    suburb,
    address_state: state,
    postcode,
    label: result.formatted_address ?? [line1, suburb, state, postcode].filter(Boolean).join(", "),
  }
}
