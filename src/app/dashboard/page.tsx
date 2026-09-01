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
} from "@/lib/registrations/transport"
import {
  clearDashboardRegistrationsCache,
  formatCacheAge,
  getDashboardRegistrationsCache,
  setDashboardRegistrationsCache,
  type DashboardRegistrationRow,
} from "@/lib/dashboard/registrations-list-cache"
import {
  filterRegistrationList,
  type RegistrationListFilterState,
} from "@/lib/dashboard/registration-list-filters"
import { buildDetailedRegistrationsCsv } from "@/lib/dashboard/reports-csv"
import { downloadTextFile } from "@/lib/dashboard/download-csv"

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
    return pickup === "—" ? "—" : pickup
  }

  return `P: ${pickup} · D: ${dropoff}`
}

const formatSubmittedDate = (value: string | null | undefined) => {
  if (!value) return "Draft"
  return new Date(value).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

const paymentStatusClass = (status: string) => {
  if (status === "paid") return "bg-emerald-100 text-emerald-800"
  if (status === "partial") return "bg-sky-100 text-sky-800"
  if (status === "overpaid") return "bg-violet-100 text-violet-800"
  return "bg-amber-100 text-amber-900"
}

const CellText = ({
  value,
  className,
}: {
  value: string
  className?: string
}) => {
  if (value === "—") {
    return <span className="text-ink-soft/50">—</span>
  }

  return (
    <span className={className} title={value}>
      {value}
    </span>
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
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState("")
  const [loadError, setLoadError] = useState("")
  useBusyCursor(isRefreshing || isExporting)

  const canEditRegistrations = !!user?.permissions.includes("registrations:write_all")
  const canEditAccommodation = !!user?.permissions.includes("accommodation:write_all")
  const canOpenEditor = canEditRegistrations || canEditAccommodation

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

  const listFilters = useMemo<RegistrationListFilterState>(
    () => ({
      search,
      paymentFilter,
      accommodationFilter,
      transpoFilter,
      stateFilter,
      souvenirFilter,
    }),
    [
      search,
      paymentFilter,
      accommodationFilter,
      transpoFilter,
      stateFilter,
      souvenirFilter,
    ]
  )

  const filtered = useMemo(
    () => filterRegistrationList(registrations, listFilters),
    [registrations, listFilters]
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE)
  const rangeStart = filtered.length === 0 ? 0 : pageStart + 1
  const rangeEnd = Math.min(pageStart + PAGE_SIZE, filtered.length)

  const handleRefresh = () => {
    void loadRegistrations(true)
  }

  const handleExportCsv = async () => {
    setIsExporting(true)
    setExportError("")
    try {
      const res = await authFetch("/api/registrations")
      if (!res.ok) {
        setExportError("Could not export registrations. Please try again.")
        return
      }
      const data = await res.json()
      const allRows = (data.registrations ?? []) as Record<string, unknown>[]
      const exportRows = filterRegistrationList(allRows, listFilters)
      const csv = buildDetailedRegistrationsCsv(exportRows)
      const dateStamp = new Date().toISOString().slice(0, 10)
      downloadTextFile(`registrations-filtered-${dateStamp}.csv`, csv)
    } catch {
      setExportError("Could not export registrations. Please try again.")
    } finally {
      setIsExporting(false)
    }
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
            onClick={() => void handleExportCsv()}
            isLoading={isExporting}
            loadingText="Exporting..."
            disabled={isExporting || isRefreshing || filtered.length === 0}
            aria-label="Export filtered registrations to CSV"
          >
            Export CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            isLoading={isRefreshing}
            loadingText="Refreshing..."
            disabled={isRefreshing || isExporting}
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
      {exportError && <p className="text-sm text-red-600" role="alert">{exportError}</p>}

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
            Showing {rangeStart}–{rangeEnd} of {filtered.length} matching
            {" · "}
            Page {currentPage} of {totalPages}
            {" · "}
            {PAGE_SIZE} per page
          </p>
        </CardHeader>
        <CardContent className="space-y-0 p-0">
          <p className="border-b border-[color:var(--line)] px-6 py-2 text-xs text-ink-soft sm:hidden">
            Swipe horizontally to see all columns and actions.
          </p>
          <div
            className="cfca-registrations-table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Registrations table, scroll horizontally for more columns"
          >
            <table className="cfca-registrations-table">
              <thead>
                <tr>
                  <th className="cfca-registrations-table__sticky-left w-[7.5rem] whitespace-nowrap" scope="col" title="Registration number">
                    Reg #
                  </th>
                  <th className="min-w-[9rem] whitespace-nowrap" scope="col">
                    Name
                  </th>
                  <th className="w-12 whitespace-nowrap" scope="col">
                    St
                  </th>
                  <th className="w-16 whitespace-nowrap" scope="col" title="Accommodation required">
                    Billet
                  </th>
                  <th className="w-20 whitespace-nowrap" scope="col" title="Transport required">
                    Transpo
                  </th>
                  <th className="min-w-[8rem] max-w-[11rem]" scope="col" title="Accommodation contact">
                    Billet contact
                  </th>
                  <th className="min-w-[8rem] max-w-[11rem]" scope="col" title="Transport contact">
                    Transpo contact
                  </th>
                  <th className="w-16 whitespace-nowrap" scope="col" title="Souvenir pre-order">
                    Shirt
                  </th>
                  <th className="w-24 whitespace-nowrap" scope="col">
                    Payment
                  </th>
                  <th className="w-24 whitespace-nowrap text-right" scope="col">
                    Amount
                  </th>
                  <th className="w-28 whitespace-nowrap" scope="col">
                    Submitted
                  </th>
                  <th
                    className="cfca-registrations-table__sticky-right w-[9.5rem] whitespace-nowrap text-right"
                    scope="col"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td className="p-6 text-ink-soft" colSpan={12}>
                      No registrations match the current filters.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => {
                    const billetContact = formatContact(
                      r.accommodation_contact_name,
                      r.accommodation_contact_phone
                    )
                    const transpoContact = formatTranspoContacts(r)
                    const souvenirLabel =
                      r.souvenir_quantity > 0 ? String(r.souvenir_quantity) : "—"

                    return (
                      <tr key={r.id}>
                        <td className="cfca-registrations-table__sticky-left whitespace-nowrap font-semibold">
                          <Link
                            href={`/dashboard/registrations/${r.id}`}
                            className="text-accent-ink underline-offset-4 hover:text-ink hover:underline"
                            title={`View ${r.registration_no}`}
                          >
                            {r.registration_no}
                          </Link>
                        </td>
                        <td className="min-w-[9rem]">
                          <span className="block font-medium text-ink">
                            {r.given_name} {r.surname}
                          </span>
                        </td>
                        <td className="whitespace-nowrap text-center text-ink-soft">{r.state}</td>
                        <td className="whitespace-nowrap">
                          {getAccommodationRequiredLabel(r.accommodation_type)}
                        </td>
                        <td className="whitespace-nowrap">
                          {getTranspoRequiredLabel(
                            r.pickup_melbourne_airport,
                            r.dropoff_melbourne_airport
                          )}
                        </td>
                        <td className="max-w-[11rem]">
                          <CellText
                            value={billetContact}
                            className="block truncate"
                          />
                        </td>
                        <td className="max-w-[11rem]">
                          <CellText
                            value={transpoContact}
                            className="block truncate"
                          />
                        </td>
                        <td className="whitespace-nowrap text-center">
                          <CellText value={souvenirLabel} />
                        </td>
                        <td className="whitespace-nowrap">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${paymentStatusClass(r.payment_status)}`}
                          >
                            {r.payment_status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap text-right font-medium tabular-nums">
                          {formatCurrency(Number(r.amount_due))}
                        </td>
                        <td className="whitespace-nowrap text-xs text-ink-soft">
                          {formatSubmittedDate(r.submitted_at)}
                        </td>
                        <td className="cfca-registrations-table__sticky-right">
                          <div className="flex flex-nowrap items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 shrink-0 px-2.5 text-xs"
                              asChild
                            >
                              <Link
                                href={`/dashboard/registrations/${r.id}`}
                                aria-label={`View registration ${r.registration_no}`}
                              >
                                View
                              </Link>
                            </Button>
                            {canOpenEditor ? (
                              <Button
                                size="sm"
                                className="h-8 shrink-0 px-2.5 text-xs"
                                asChild
                              >
                                <Link
                                  href={`/dashboard/registrations/${r.id}?edit=1`}
                                  aria-label={`Edit registration ${r.registration_no}`}
                                >
                                  Edit
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--line)] px-6 py-4">
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
