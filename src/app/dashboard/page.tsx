"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/context"
import { isManager } from "@/lib/auth/permissions-client"
import { useBusyCursor } from "@/hooks/use-busy-cursor"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/pricing/calculate"
import { AUSTRALIAN_STATES } from "@/lib/registrations/schema"
import {
  booleansToTransportOption,
  getTransportOptionLabel,
} from "@/lib/registrations/transport"
import {
  clearDashboardRegistrationsCache,
  formatCacheAge,
  getDashboardRegistrationsCache,
  setDashboardRegistrationsCache,
  type DashboardRegistrationRow,
} from "@/lib/dashboard/registrations-list-cache"

const PAGE_SIZE = 100
const PAYMENT_STATUSES = ["pending", "partial", "paid", "overpaid"] as const

const formatContact = (name?: string | null, phone?: string | null) => {
  const parts = [name?.trim(), phone?.trim()].filter(Boolean)
  return parts.length > 0 ? parts.join(" · ") : "—"
}

const getAccommodationRequiredLabel = (type: string | null | undefined) => {
  if (type === "billet") return "Yes"
  if (type === "own") return "No"
  return "—"
}

const getTranspoRequiredLabel = (
  pickup?: boolean | null,
  dropoff?: boolean | null
) => {
  if (pickup == null && dropoff == null) return "—"
  const option = booleansToTransportOption(pickup, dropoff)
  if (option === "own") return "No"
  if (option === "pickup") return "Pickup"
  if (option === "dropoff") return "Drop-off"
  return "Both"
}

const formatTranspoContacts = (r: DashboardRegistrationRow) => {
  const option = booleansToTransportOption(
    r.pickup_melbourne_airport,
    r.dropoff_melbourne_airport
  )
  if (option === "own") return "—"

  const pickup = formatContact(
    r.pickup_transport_contact_name,
    r.pickup_transport_contact_phone
  )
  const dropoff = formatContact(
    r.dropoff_transport_contact_name,
    r.dropoff_transport_contact_phone
  )

  if (option === "pickup") return pickup
  if (option === "dropoff") return dropoff

  if (pickup === dropoff) {
    return pickup === "—" ? "—" : `Both: ${pickup}`
  }

  return (
    <>
      <div>Pickup: {pickup}</div>
      <div>Drop-off: {dropoff}</div>
    </>
  )
}

const selectClass =
  "flex h-10 w-full rounded-md border border-[color:var(--line-strong)] bg-mist/80 px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"

const DashboardPage = () => {
  const { user, authFetch } = useAuth()
  const router = useRouter()
  const [registrations, setRegistrations] = useState<DashboardRegistrationRow[]>([])
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [paymentFilter, setPaymentFilter] = useState("")
  const [accommodationFilter, setAccommodationFilter] = useState("")
  const [transpoFilter, setTranspoFilter] = useState("")
  const [stateFilter, setStateFilter] = useState("")
  const [souvenirFilter, setSouvenirFilter] = useState("")
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState("")
  useBusyCursor(isRefreshing)

  const loadRegistrations = useCallback(
    async (forceRefresh: boolean) => {
      if (!forceRefresh) {
        const cached = getDashboardRegistrationsCache()
        if (cached?.isFresh) {
          setRegistrations(cached.rows)
          setFetchedAt(cached.fetchedAt)
          setIsLoading(false)
          return
        }
        if (cached) {
          setRegistrations(cached.rows)
          setFetchedAt(cached.fetchedAt)
          setIsLoading(false)
        }
      } else {
        clearDashboardRegistrationsCache()
      }

      if (forceRefresh) setIsRefreshing(true)
      else if (!getDashboardRegistrationsCache()) setIsLoading(true)

      setLoadError("")
      try {
        const res = await authFetch("/api/registrations")
        if (!res.ok) {
          setLoadError("Could not load registrations.")
          return
        }
        const data = await res.json()
        const entry = setDashboardRegistrationsCache(
          (data.registrations ?? []) as Record<string, unknown>[]
        )
        setRegistrations(entry.rows)
        setFetchedAt(entry.fetchedAt)
      } catch {
        setLoadError("Could not load registrations.")
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [authFetch]
  )

  useEffect(() => {
    if (!user) return
    if (!isManager(user)) {
      router.push("/")
      return
    }
    void loadRegistrations(false)
  }, [user, router, loadRegistrations])

  useEffect(() => {
    setPage(1)
  }, [search, paymentFilter, accommodationFilter, transpoFilter, stateFilter, souvenirFilter])

  const filtered = useMemo(() => {
    return registrations.filter((r) => {
      const q = search.toLowerCase()
      const matchesSearch =
        !q ||
        r.registration_no?.toLowerCase().includes(q) ||
        r.surname?.toLowerCase().includes(q) ||
        r.given_name?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.state?.toLowerCase().includes(q) ||
        r.accommodation_contact_name?.toLowerCase().includes(q) ||
        r.pickup_transport_contact_name?.toLowerCase().includes(q) ||
        r.dropoff_transport_contact_name?.toLowerCase().includes(q)

      if (!matchesSearch) return false
      if (paymentFilter && r.payment_status !== paymentFilter) return false
      if (accommodationFilter === "yes" && r.accommodation_type !== "billet") return false
      if (accommodationFilter === "no" && r.accommodation_type !== "own") return false

      if (transpoFilter) {
        const option = booleansToTransportOption(
          r.pickup_melbourne_airport,
          r.dropoff_melbourne_airport
        )
        if (transpoFilter === "none" && option !== "own") return false
        if (transpoFilter === "pickup" && option !== "pickup") return false
        if (transpoFilter === "dropoff" && option !== "dropoff") return false
        if (transpoFilter === "both" && option !== "pickup_dropoff") return false
      }

      if (stateFilter && r.state !== stateFilter) return false

      if (souvenirFilter === "yes" && !(r.souvenir_quantity > 0)) return false
      if (souvenirFilter === "no" && r.souvenir_quantity > 0) return false

      return true
    })
  }, [
    registrations,
    search,
    paymentFilter,
    accommodationFilter,
    transpoFilter,
    stateFilter,
    souvenirFilter,
  ])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE)
  const rangeStart = filtered.length === 0 ? 0 : pageStart + 1
  const rangeEnd = Math.min(pageStart + PAGE_SIZE, filtered.length)

  const handleRefresh = () => {
    void loadRegistrations(true)
  }

  if (isLoading) return <p className="text-center text-ink-soft">Loading dashboard...</p>

  return (
    <div className="cfca-page space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-ink">
            Staff workspace
          </p>
          <h1 className="font-display text-4xl font-semibold text-ink">
            Registrations Dashboard
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            isLoading={isRefreshing}
            loadingText="Refreshing..."
            disabled={isRefreshing}
            aria-label="Refresh registrations list"
          >
            Refresh
          </Button>
        </div>
      </div>

      {fetchedAt != null && (
        <p className="text-sm text-gray-500">
          List data cached · updated {formatCacheAge(fetchedAt)}
          {" · "}
          {registrations.length} loaded
        </p>
      )}
      {loadError && <p className="text-sm text-red-600" role="alert">{loadError}</p>}

      <Input
        placeholder="Search by name, email, registration no, state, contact..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search registrations"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1">
          <Label htmlFor="filter-payment">Payment status</Label>
          <select
            id="filter-payment"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className={selectClass}
            aria-label="Filter by payment status"
          >
            <option value="">All</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="filter-accommodation">Accommodation</Label>
          <select
            id="filter-accommodation"
            value={accommodationFilter}
            onChange={(e) => setAccommodationFilter(e.target.value)}
            className={selectClass}
            aria-label="Filter by accommodation required"
          >
            <option value="">All</option>
            <option value="yes">Required (Yes)</option>
            <option value="no">Self arranged (No)</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="filter-transpo">Transpo</Label>
          <select
            id="filter-transpo"
            value={transpoFilter}
            onChange={(e) => setTranspoFilter(e.target.value)}
            className={selectClass}
            aria-label="Filter by transport required"
          >
            <option value="">All</option>
            <option value="none">No</option>
            <option value="pickup">Pickup</option>
            <option value="dropoff">Drop-off</option>
            <option value="both">Both</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="filter-state">State</Label>
          <select
            id="filter-state"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className={selectClass}
            aria-label="Filter by state"
          >
            <option value="">All</option>
            {AUSTRALIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="filter-souvenir">Souvenir pre-order</Label>
          <select
            id="filter-souvenir"
            value={souvenirFilter}
            onChange={(e) => setSouvenirFilter(e.target.value)}
            className={selectClass}
            aria-label="Filter by souvenir pre-order"
          >
            <option value="">All</option>
            <option value="yes">Has pre-order</option>
            <option value="no">No pre-order</option>
          </select>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>
            {filtered.length} matching
            {filtered.length !== registrations.length
              ? ` (of ${registrations.length} loaded)`
              : " registrations"}
          </CardTitle>
          <p className="text-sm text-gray-600" aria-live="polite">
            Showing {rangeStart}–{rangeEnd} · Page {currentPage} of {totalPages}
            {" · "}
            {PAGE_SIZE} per page
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2">Reg No</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">State</th>
                  <th className="p-2">Accommodation required</th>
                  <th className="p-2">Transpo required</th>
                  <th className="p-2">Accommodation contact</th>
                  <th className="p-2">Transpo contact</th>
                  <th className="p-2">Souvenir</th>
                  <th className="p-2">Payment</th>
                  <th className="p-2">Amount</th>
                  <th className="p-2">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td className="p-4 text-gray-500" colSpan={11}>
                      No registrations match the current filters.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => (
                    <tr key={r.id} className="border-b border-[color:var(--line)] transition-colors hover:bg-surface-muted/80">
                      <td className="p-2">
                        <Link
                          href={`/dashboard/registrations/${r.id}`}
                          className="font-semibold text-ink underline-offset-4 hover:text-accent-ink hover:underline"
                          title={getTransportOptionLabel(
                            booleansToTransportOption(
                              r.pickup_melbourne_airport,
                              r.dropoff_melbourne_airport
                            )
                          )}
                        >
                          {r.registration_no}
                        </Link>
                      </td>
                      <td className="p-2">{r.given_name} {r.surname}</td>
                      <td className="p-2">{r.state}</td>
                      <td className="p-2">{getAccommodationRequiredLabel(r.accommodation_type)}</td>
                      <td className="p-2">
                        {getTranspoRequiredLabel(
                          r.pickup_melbourne_airport,
                          r.dropoff_melbourne_airport
                        )}
                      </td>
                      <td className="p-2">
                        {formatContact(
                          r.accommodation_contact_name,
                          r.accommodation_contact_phone
                        )}
                      </td>
                      <td className="p-2">{formatTranspoContacts(r)}</td>
                      <td className="p-2">
                        {r.souvenir_quantity > 0 ? `${r.souvenir_quantity} shirt(s)` : "—"}
                      </td>
                      <td className="p-2">{r.payment_status}</td>
                      <td className="p-2">{formatCurrency(Number(r.amount_due))}</td>
                      <td className="p-2">
                        {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : "Draft"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || isRefreshing}
              aria-label="Previous page"
            >
              Previous
            </Button>
            <p className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || isRefreshing}
              aria-label="Next page"
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default DashboardPage
