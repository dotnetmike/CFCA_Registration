"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useBusyCursor } from "@/hooks/use-busy-cursor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert } from "@/components/ui/alert"
import { DashboardSubnav } from "@/components/layout/dashboard-subnav"
import {
  USER_GROUP_OPTIONS,
  formatUserGroupLabel,
  type UserGroupName,
} from "@/lib/auth/user-groups"

type UserRow = {
  id: string
  email: string
  name: string
  is_active: boolean
  groups: string[]
}

const UsersPage = () => {
  const { user, authFetch } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<UserRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null)
  const [savingRolesUserId, setSavingRolesUserId] = useState<string | null>(null)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [draftGroups, setDraftGroups] = useState<UserGroupName[]>([])
  useBusyCursor(isCreating || revokingUserId !== null || savingRolesUserId !== null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [newUser, setNewUser] = useState({
    email: "",
    name: "",
    password: "",
    groups: ["participant"] as UserGroupName[],
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
    if (newUser.groups.length === 0) {
      setError("Select at least one role")
      return
    }
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
    setError("")
    setSuccess("")
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

  const handleStartEditRoles = (row: UserRow) => {
    setError("")
    setSuccess("")
    setEditingUserId(row.id)
    setDraftGroups(
      row.groups.filter((g): g is UserGroupName =>
        USER_GROUP_OPTIONS.some((opt) => opt.value === g)
      )
    )
  }

  const handleCancelEditRoles = () => {
    setEditingUserId(null)
    setDraftGroups([])
  }

  const handleToggleDraftGroup = (group: UserGroupName) => {
    setDraftGroups((current) =>
      current.includes(group)
        ? current.filter((g) => g !== group)
        : [...current, group]
    )
  }

  const handleSaveRoles = async (userId: string) => {
    setError("")
    setSuccess("")
    if (draftGroups.length === 0) {
      setError("Select at least one role")
      return
    }

    setSavingRolesUserId(userId)
    try {
      const res = await authFetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, groups: draftGroups }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Could not update roles")
        return
      }

      setSuccess("Roles updated (user must log in again for new permissions)")
      setEditingUserId(null)
      setDraftGroups([])
      await loadUsers()
    } finally {
      setSavingRolesUserId(null)
    }
  }

  const isBusy =
    isCreating || revokingUserId !== null || savingRolesUserId !== null

  if (isLoading) return <p className="text-center text-gray-500">Loading users...</p>

  return (
    <div className="space-y-6">
      <DashboardSubnav />

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">User Management</h1>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Create User</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
            <fieldset disabled={isBusy} className="contents">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  required
                  aria-label="New user email"
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  required
                  aria-label="New user name"
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                  minLength={8}
                  aria-label="New user password"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Roles</Label>
                <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="New user roles">
                  {USER_GROUP_OPTIONS.map((group) => (
                    <label
                      key={group.value}
                      className="flex items-center gap-2 text-sm text-gray-800"
                    >
                      <input
                        type="checkbox"
                        checked={newUser.groups.includes(group.value)}
                        onChange={() => {
                          setNewUser((prev) => ({
                            ...prev,
                            groups: prev.groups.includes(group.value)
                              ? prev.groups.filter((g) => g !== group.value)
                              : [...prev.groups, group.value],
                          }))
                        }}
                        aria-label={group.label}
                      />
                      {group.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <Button
                  type="submit"
                  isLoading={isCreating}
                  loadingText="Creating user..."
                  disabled={isBusy}
                  aria-label="Create user"
                >
                  Create User
                </Button>
              </div>
            </fieldset>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2">Name</th>
                <th className="p-2">Email</th>
                <th className="p-2">Roles</th>
                <th className="p-2">Active</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isEditing = editingUserId === u.id
                return (
                  <tr key={u.id} className="border-b align-top">
                    <td className="p-2">{u.name}</td>
                    <td className="p-2">{u.email}</td>
                    <td className="p-2">
                      {isEditing ? (
                        <div
                          className="grid gap-2"
                          role="group"
                          aria-label={`Edit roles for ${u.name}`}
                        >
                          {USER_GROUP_OPTIONS.map((group) => (
                            <label
                              key={group.value}
                              className="flex items-center gap-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={draftGroups.includes(group.value)}
                                onChange={() => handleToggleDraftGroup(group.value)}
                                disabled={savingRolesUserId === u.id}
                                aria-label={`${group.label} for ${u.name}`}
                              />
                              {group.label}
                            </label>
                          ))}
                        </div>
                      ) : (
                        u.groups.map(formatUserGroupLabel).join(", ") || "—"
                      )}
                    </td>
                    <td className="p-2">{u.is_active ? "Yes" : "No"}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-2">
                        {isEditing ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleSaveRoles(u.id)}
                              isLoading={savingRolesUserId === u.id}
                              loadingText="Saving..."
                              disabled={isBusy}
                              aria-label={`Save roles for ${u.name}`}
                            >
                              Save roles
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEditRoles}
                              disabled={savingRolesUserId === u.id}
                              aria-label={`Cancel editing roles for ${u.name}`}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStartEditRoles(u)}
                            disabled={isBusy}
                            aria-label={`Edit roles for ${u.name}`}
                          >
                            Edit roles
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRevokeSessions(u.id)}
                          isLoading={revokingUserId === u.id}
                          loadingText="Revoking..."
                          disabled={isBusy}
                          aria-label={`Revoke sessions for ${u.name}`}
                        >
                          Kill Sessions
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

export default UsersPage
