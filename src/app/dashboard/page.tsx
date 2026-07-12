"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/context"
import { isManager } from "@/lib/auth/permissions-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/lib/pricing/calculate"
import {
  booleansToTransportOption,
  getTransportOptionLabel,
} from "@/lib/registrations/transport"

type RegistrationRow = {
  id: string
  registration_no: string
  surname: string
  given_name: string
  email: string
  state: string
  payment_status: string
  amount_due: number
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
}

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

const formatTranspoContacts = (r: RegistrationRow) => {
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

const DashboardPage = () => {
  const { user, authFetch } = useAuth()
  const router = useRouter()
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([])
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    if (!isManager(user)) {
      router.push("/")
      return
    }

    const load = async () => {
      const res = await authFetch("/api/registrations")
      if (res.ok) {
        const data = await res.json()
        setRegistrations(data.registrations ?? [])
      }
      setIsLoading(false)
    }
    load()
  }, [user, authFetch, router])

  const filtered = registrations.filter((r) => {
    const q = search.toLowerCase()
    return (
      r.registration_no?.toLowerCase().includes(q) ||
      r.surname?.toLowerCase().includes(q) ||
      r.given_name?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q) ||
      r.state?.toLowerCase().includes(q) ||
      r.accommodation_contact_name?.toLowerCase().includes(q) ||
      r.pickup_transport_contact_name?.toLowerCase().includes(q) ||
      r.dropoff_transport_contact_name?.toLowerCase().includes(q)
    )
  })

  if (isLoading) return <p className="text-center text-gray-500">Loading dashboard...</p>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Registrations Dashboard</h1>
        <nav className="flex gap-4 text-sm">
          <Link href="/dashboard/reports" className="text-blue-600 hover:underline">Reports</Link>
          {user?.permissions.includes("payments:reconcile") && (
            <Link href="/dashboard/payments/reconcile" className="text-blue-600 hover:underline">Payment Reconcile</Link>
          )}
          {user?.permissions.includes("users:manage") && (
            <>
              <Link href="/dashboard/users" className="text-blue-600 hover:underline">Users</Link>
              <Link href="/dashboard/audit" className="text-blue-600 hover:underline">Audit Log</Link>
            </>
          )}
        </nav>
      </div>

      <Input
        placeholder="Search by name, email, registration no, state, contact..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search registrations"
      />

      <Card>
        <CardHeader>
          <CardTitle>{filtered.length} Registrations</CardTitle>
        </CardHeader>
        <CardContent>
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
                  <th className="p-2">Payment</th>
                  <th className="p-2">Amount</th>
                  <th className="p-2">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">
                      <Link
                        href={`/dashboard/registrations/${r.id}`}
                        className="text-blue-600 hover:underline"
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
                    <td className="p-2">{r.payment_status}</td>
                    <td className="p-2">{formatCurrency(Number(r.amount_due))}</td>
                    <td className="p-2">
                      {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : "Draft"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default DashboardPage
