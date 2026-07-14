"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardSubnav } from "@/components/layout/dashboard-subnav"

type AuditLogRow = {
  id: string
  user_id: string | null
  action: string
  previous_value: Record<string, unknown> | null
  updated_value: Record<string, unknown> | null
  metadata: Record<string, unknown>
  ip_address: string | null
  created_at: string
  users: { name: string; email: string } | null
}

const formatJson = (value: Record<string, unknown> | null) => {
  if (!value || Object.keys(value).length === 0) return "—"
  return JSON.stringify(value, null, 2)
}

const AuditLogPage = () => {
  const { user, authFetch } = useAuth()
  const router = useRouter()
  const [logs, setLogs] = useState<AuditLogRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    if (!user.permissions.includes("users:manage")) {
      router.push("/")
      return
    }

    const load = async () => {
      const res = await authFetch("/api/admin/audit-log?limit=100")
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs ?? [])
      }
      setIsLoading(false)
    }

    load()
  }, [user, authFetch, router])

  if (isLoading) return <p className="text-center text-gray-500">Loading audit log...</p>

  return (
    <div className="space-y-6">
      <DashboardSubnav />
      <h1 className="text-3xl font-bold">Audit Log</h1>

      <Card>
        <CardHeader>
          <CardTitle>Recent Actions</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2">Date/Time</th>
                <th className="p-2">User</th>
                <th className="p-2">Action</th>
                <th className="p-2">Previous Value</th>
                <th className="p-2">Updated Value</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b align-top">
                  <td className="p-2 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="p-2">
                    {log.users ? (
                      <div>
                        <div className="font-medium">{log.users.name}</div>
                        <div className="text-xs text-gray-500">{log.users.email}</div>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="p-2 font-mono text-xs">{log.action}</td>
                  <td className="p-2">
                    <pre className="max-w-xs overflow-x-auto whitespace-pre-wrap text-xs text-gray-600">
                      {formatJson(log.previous_value)}
                    </pre>
                  </td>
                  <td className="p-2">
                    <pre className="max-w-xs overflow-x-auto whitespace-pre-wrap text-xs text-gray-600">
                      {formatJson(log.updated_value)}
                    </pre>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-gray-500">
                    No audit entries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

export default AuditLogPage
