"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/context"
import { isManager } from "@/lib/auth/permissions-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useBusyCursor } from "@/hooks/use-busy-cursor"
import { Button } from "@/components/ui/button"
import { DashboardSubnav } from "@/components/layout/dashboard-subnav"

type Summary = Record<string, { attendees: number; spouses: number; kids: number; registrations: number }>

const ReportsPage = () => {
  const { user, authFetch } = useAuth()
  const router = useRouter()
  const [summary, setSummary] = useState<Summary>({})
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  useBusyCursor(isExporting)

  useEffect(() => {
    if (!user) return
    if (!isManager(user)) {
      router.push("/")
      return
    }

    const load = async () => {
      const res = await authFetch("/api/admin/reports")
      if (res.ok) {
        const data = await res.json()
        setSummary(data.summary ?? {})
        setTotal((data.registrations ?? []).length)
      }
      setIsLoading(false)
    }
    load()
  }, [user, authFetch, router])

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const res = await authFetch("/api/admin/reports?format=csv")
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "registrations.csv"
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsExporting(false)
    }
  }

  if (isLoading) return <p className="text-center text-gray-500">Loading reports...</p>

  return (
    <div className="space-y-6">
      <DashboardSubnav />
      <h1 className="text-3xl font-bold">Reports</h1>

      <Card>
        <CardHeader>
          <CardTitle>Summary by State ({total} registrations)</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2">State</th>
                <th className="p-2">Registrations</th>
                <th className="p-2">Attendees</th>
                <th className="p-2">Spouses</th>
                <th className="p-2">Kids</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(summary).map(([state, data]) => (
                <tr key={state} className="border-b">
                  <td className="p-2 font-medium">{state}</td>
                  <td className="p-2">{data.registrations}</td>
                  <td className="p-2">{data.attendees}</td>
                  <td className="p-2">{data.spouses}</td>
                  <td className="p-2">{data.kids}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Button
        onClick={handleExport}
        isLoading={isExporting}
        loadingText="Exporting..."
        disabled={isExporting}
        aria-label="Export CSV"
      >
        Export Detailed CSV
      </Button>
    </div>
  )
}

export default ReportsPage
