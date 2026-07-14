import { souvenirTotalQuantity } from "@/lib/registrations/souvenirs"
import {
  DASHBOARD_LIST_CACHE_MAX_ROWS,
  DASHBOARD_LIST_CACHE_TTL_MS,
  formatCacheAge,
} from "@/lib/dashboard/list-cache"

export { DASHBOARD_LIST_CACHE_MAX_ROWS, DASHBOARD_LIST_CACHE_TTL_MS, formatCacheAge }

export type DashboardRegistrationRow = {
  id: string
  registration_no: string
  surname: string
  given_name: string
  email: string
  state: string
  payment_status: string
  amount_due: number
  amount_paid: number
  submitted_at: string | null
  accommodation_type: string | null
  pickup_melbourne_airport: boolean | null
  dropoff_melbourne_airport: boolean | null
  accommodation_contact_name: string | null
  accommodation_contact_phone: string | null
  pickup_transport_contact_name: string | null
  pickup_transport_contact_phone: string | null
  dropoff_transport_contact_name: string | null
  dropoff_transport_contact_phone: string | null
  souvenir_orders?: unknown
  souvenir_quantity: number
}

type CacheEntry = {
  fetchedAt: number
  rows: DashboardRegistrationRow[]
}

const CACHE_KEY = "cfca.dashboard.registrations.v2"

let memoryCache: CacheEntry | null = null

const slimRow = (raw: Record<string, unknown>): DashboardRegistrationRow => ({
  id: String(raw.id ?? ""),
  registration_no: String(raw.registration_no ?? ""),
  surname: String(raw.surname ?? ""),
  given_name: String(raw.given_name ?? ""),
  email: String(raw.email ?? ""),
  state: String(raw.state ?? ""),
  payment_status: String(raw.payment_status ?? ""),
  amount_due: Number(raw.amount_due ?? 0),
  amount_paid: Number(raw.amount_paid ?? 0),
  submitted_at: (raw.submitted_at as string | null) ?? null,
  accommodation_type: (raw.accommodation_type as string | null) ?? null,
  pickup_melbourne_airport: (raw.pickup_melbourne_airport as boolean | null) ?? null,
  dropoff_melbourne_airport: (raw.dropoff_melbourne_airport as boolean | null) ?? null,
  accommodation_contact_name: (raw.accommodation_contact_name as string | null) ?? null,
  accommodation_contact_phone: (raw.accommodation_contact_phone as string | null) ?? null,
  pickup_transport_contact_name: (raw.pickup_transport_contact_name as string | null) ?? null,
  pickup_transport_contact_phone: (raw.pickup_transport_contact_phone as string | null) ?? null,
  dropoff_transport_contact_name: (raw.dropoff_transport_contact_name as string | null) ?? null,
  dropoff_transport_contact_phone: (raw.dropoff_transport_contact_phone as string | null) ?? null,
  souvenir_orders: raw.souvenir_orders ?? [],
  souvenir_quantity: souvenirTotalQuantity(raw.souvenir_orders),
})

export const slimDashboardRegistrations = (
  registrations: Record<string, unknown>[]
): DashboardRegistrationRow[] =>
  registrations.slice(0, DASHBOARD_LIST_CACHE_MAX_ROWS).map(slimRow)

const isFresh = (entry: CacheEntry, now = Date.now()) =>
  now - entry.fetchedAt < DASHBOARD_LIST_CACHE_TTL_MS

const readSessionCache = (): CacheEntry | null => {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEntry
    if (!parsed?.fetchedAt || !Array.isArray(parsed.rows)) return null
    if (parsed.rows.length > DASHBOARD_LIST_CACHE_MAX_ROWS) return null
    return parsed
  } catch {
    return null
  }
}

const writeSessionCache = (entry: CacheEntry) => {
  if (typeof window === "undefined") return
  try {
    // Skip session persistence when the payload is large; memory cache still helps within-tab navigation
    const approxBytes = JSON.stringify(entry).length
    if (approxBytes > 800_000) {
      sessionStorage.removeItem(CACHE_KEY)
      return
    }
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch {
    try {
      sessionStorage.removeItem(CACHE_KEY)
    } catch {
      // ignore quota errors
    }
  }
}

export const getDashboardRegistrationsCache = (): {
  rows: DashboardRegistrationRow[]
  fetchedAt: number
  isFresh: boolean
} | null => {
  const entry = memoryCache ?? readSessionCache()
  if (!entry) return null
  if (!memoryCache) memoryCache = entry
  return {
    rows: entry.rows,
    fetchedAt: entry.fetchedAt,
    isFresh: isFresh(entry),
  }
}

export const setDashboardRegistrationsCache = (
  registrations: Record<string, unknown>[]
) => {
  const entry: CacheEntry = {
    fetchedAt: Date.now(),
    rows: slimDashboardRegistrations(registrations),
  }
  memoryCache = entry
  writeSessionCache(entry)
  return entry
}

export const clearDashboardRegistrationsCache = () => {
  memoryCache = null
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(CACHE_KEY)
  } catch {
    // ignore
  }
}
