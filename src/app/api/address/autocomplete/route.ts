import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api"
import { getGooglePlacesApiKey } from "@/lib/address/env"
import {
  parseGooglePlaceDetails,
  parseNominatimResult,
  normalizeAustralianState,
  type AustralianAddress,
} from "@/lib/address/parse"

type NominatimItem = {
  display_name: string
  address?: Record<string, string>
}

type GoogleAutocompletePrediction = {
  place_id: string
  description: string
}

type GoogleAutocompleteResponse = {
  status: string
  error_message?: string
  predictions?: GoogleAutocompletePrediction[]
}

type GooglePlaceDetailsResponse = {
  status: string
  error_message?: string
  result?: {
    formatted_address?: string
    address_components?: { long_name: string; short_name: string; types: string[] }[]
  }
}

const searchNominatim = async (query: string): Promise<AustralianAddress[]> => {
  const params = new URLSearchParams({
    format: "json",
    addressdetails: "1",
    countrycodes: "au",
    limit: "8",
    q: query,
  })

  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "User-Agent": "CFCA-Registration/1.0 (contact@cfca.org.au)" },
    cache: "no-store",
  })

  if (!res.ok) return []

  const data = (await res.json()) as NominatimItem[]
  return data
    .map((item) => parseNominatimResult(item) ?? {
      address_line1: item.display_name.split(",")[0] ?? "",
      address_line2: "",
      suburb: item.address?.suburb ?? item.address?.city ?? "",
      address_state: normalizeAustralianState(item.address?.state),
      postcode: item.address?.postcode ?? "",
      label: item.display_name,
    })
    .filter((item) => item.label.length > 0)
}

const searchGoogleAutocomplete = async (
  query: string
): Promise<{ placeId: string; label: string }[]> => {
  const apiKey = getGooglePlacesApiKey()
  if (!apiKey) return []

  const params = new URLSearchParams({
    input: query,
    components: "country:au",
    types: "address",
    key: apiKey,
  })

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`,
    { cache: "no-store" }
  )

  if (!res.ok) return []

  const data = (await res.json()) as GoogleAutocompleteResponse
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.error("[address] Google autocomplete error:", data.status, data.error_message)
    return []
  }

  return (data.predictions ?? []).map((p) => ({
    placeId: p.place_id,
    label: p.description,
  }))
}

const fetchGooglePlaceDetails = async (placeId: string): Promise<AustralianAddress | null> => {
  const apiKey = getGooglePlacesApiKey()
  if (!apiKey) return null

  const params = new URLSearchParams({
    place_id: placeId,
    fields: "address_components,formatted_address",
    key: apiKey,
  })

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?${params}`,
    { cache: "no-store" }
  )

  if (!res.ok) return null

  const data = (await res.json()) as GooglePlaceDetailsResponse
  if (data.status !== "OK") {
    console.error("[address] Google place details error:", data.status, data.error_message)
    return null
  }

  return parseGooglePlaceDetails(data.result ?? {})
}

export const GET = async (request: NextRequest) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")?.trim() ?? ""
  const placeId = searchParams.get("placeId")?.trim()

  if (placeId) {
    const address = await fetchGooglePlaceDetails(placeId)
    if (!address) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 })
    }
    return NextResponse.json({ address })
  }

  if (query.length < 3) {
    return NextResponse.json({ suggestions: [] })
  }

  const googlePredictions = await searchGoogleAutocomplete(query)
  const nominatimResults =
    googlePredictions.length > 0 ? [] : await searchNominatim(query)

  const googleSuggestions = googlePredictions.map((item) => ({
    id: item.placeId,
    label: item.label,
    source: "google" as const,
  }))

  const nominatimSuggestions = nominatimResults.map((item, index) => ({
    id: `nominatim-${index}`,
    label: item.label,
    source: "nominatim" as const,
    address: item,
  }))

  const suggestions = [...googleSuggestions, ...nominatimSuggestions].slice(0, 8)

  return NextResponse.json({ suggestions })
}
