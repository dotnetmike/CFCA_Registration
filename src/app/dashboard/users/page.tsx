"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth/context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useBusyCursor } from "@/hooks/use-busy-cursor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert } from "@/components/ui/alert"

type UserRow = {
  id: string
  email: string
  name: string
  is_active: boolean
  groups: string[]
}

const GROUPS = ["admin", "registration_manager", "accommodation_manager", "participant"]

const UsersPage = () => {
  const { user, authFetch } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<UserRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null)
  useBusyCursor(isCreating || revokingUserId !== null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [newUser, setNewUser] = useState({
    email: "",
    name: "",
    password: "",
    groups: ["participant"],
  })

  const loadUsers = async () => {
    const res = await authFetch("/api/admin/users")
    if (res.ok) {
      const data = await res.json()
      setUsers(data.users ?? [])
    }
    setIsLoading(false)
  }

  useEffect(() => {
    if (!user) return
    if (!user.permissions.includes("users:manage")) {
      router.push("/dashboard")
      return
    }
    loadUsers()
  }, [user, authFetch, router]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setIsCreating(true)

    const res = await authFetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? "Create failed")
    } else {
      setSuccess("User created")
      setNewUser({ email: "", name: "", password: "", groups: ["participant"] })
      await loadUsers()
    }
    setIsCreating(false)
  }

  const handleRevokeSessions = async (userId: string) => {
    setRevokingUserId(userId)
    try {
      await authFetch("/api/auth/sessions/revoke-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      setSuccess("Sessions revoked")
    } finally {
      setRevokingUserId(null)
    }
  }

  if (isLoading) return <p className="text-center text-gray-500">Loading users...</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">User Management</h1>
        <Link href="/dashboard" className="text-blue-600 hover:underline">← Dashboard</Link>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Card>
        <CardHeader><CardTitle>Create User</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
            <fieldset disabled={isCreating} className="contents">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} required aria-label="New user email" />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} required aria-label="New user name" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required minLength={8} aria-label="New user password" />
            </div>
            <div className="space-y-2">
              <Label>Groups</Label>
              <select
                multiple
                className="flex min-h-24 w-full rounded-md border border-gray-300 px-3 text-sm"
                value={newUser.groups}
                onChange={(e) => setNewUser({ ...newUser, groups: Array.from(e.target.selectedOptions, (o) => o.value) })}
                aria-label="User groups"
              >
                {GROUPS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" isLoading={isCreating} loadingText="Creating user..." disabled={isCreating} aria-label="Create user">
                Create User
              </Button>
            </div>
            </fieldset>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Users ({users.length})</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2">Name</th>
                <th className="p-2">Email</th>
                <th className="p-2">Groups</th>
                <th className="p-2">Active</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b">
                  <td className="p-2">{u.name}</td>
                  <td className="p-2">{u.email}</td>
                  <td className="p-2">{u.groups.join(", ")}</td>
                  <td className="p-2">{u.is_active ? "Yes" : "No"}</td>
                  <td className="p-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRevokeSessions(u.id)}
                      isLoading={revokingUserId === u.id}
                      loadingText="Revoking..."
                      disabled={revokingUserId !== null}
                      aria-label={`Revoke sessions for ${u.name}`}
                    >
                      Kill Sessions
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

export default UsersPage
