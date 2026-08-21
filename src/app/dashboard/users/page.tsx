"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useBusyCursor } from "@/hooks/use-busy-cursor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert } from "@/components/ui/alert"
import {
  USER_GROUP_OPTIONS,
  formatUserGroupLabel,
  type UserGroupName,
} from "@/lib/auth/user-groups"
import { DASHBOARD_PAGE_SIZE, formatCacheAge } from "@/lib/dashboard/list-cache"
import {
  usersListCache,
  type DashboardUserRow,
} from "@/lib/dashboard/users-list-cache"

const UsersPage = () => {
  const { user, authFetch } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<DashboardUserRow[]>([])
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null)
  const [savingRolesUserId, setSavingRolesUserId] = useState<string | null>(null)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [draftGroups, setDraftGroups] = useState<UserGroupName[]>([])
  useBusyCursor(
    isCreating ||
      revokingUserId !== null ||
      savingRolesUserId !== null ||
      isRefreshing
  )
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [newUser, setNewUser] = useState({
    email: "",
    name: "",
    password: "",
    groups: ["participant"] as UserGroupName[],
  })

  const loadUsers = useCallback(
    async (forceRefresh: boolean) => {
      if (!forceRefresh) {
        const cached = usersListCache.get()
        if (cached?.isFresh) {
          setUsers(cached.rows)
          setFetchedAt(cached.fetchedAt)
          setIsLoading(false)
          return
        }
        if (cached) {
          setUsers(cached.rows)
          setFetchedAt(cached.fetchedAt)
          setIsLoading(false)
        }
      } else {
        usersListCache.clear()
      }

      if (forceRefresh) setIsRefreshing(true)
      else if (!usersListCache.get()) setIsLoading(true)

      setLoadError("")
      try {
        const res = await authFetch("/api/admin/users")
        if (!res.ok) {
          setLoadError("Could not load users.")
          return
        }
        const data = await res.json()
        const entry = usersListCache.set((data.users ?? []) as DashboardUserRow[])
        setUsers(entry.rows)
        setFetchedAt(entry.fetchedAt)
      } catch {
        setLoadError("Could not load users.")
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [authFetch]
  )

  useEffect(() => {
    if (!user) return
    if (!user.permissions.includes("users:manage")) {
      router.push("/dashboard")
      return
    }
    void loadUsers(false)
  }, [user, router, loadUsers])

  const totalPages = Math.max(1, Math.ceil(users.length / DASHBOARD_PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * DASHBOARD_PAGE_SIZE
  const pageRows = useMemo(
    () => users.slice(pageStart, pageStart + DASHBOARD_PAGE_SIZE),
    [users, pageStart]
  )
  const rangeStart = users.length === 0 ? 0 : pageStart + 1
  const rangeEnd = Math.min(pageStart + DASHBOARD_PAGE_SIZE, users.length)

  const reloadFresh = async () => {
    usersListCache.clear()
    await loadUsers(true)
  }

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
      setPage(1)
      await reloadFresh()
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

  const handleStartEditRoles = (row: DashboardUserRow) => {
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
      await reloadFresh()
    } finally {
      setSavingRolesUserId(null)
    }
  }

  const isBusy =
    isCreating ||
    revokingUserId !== null ||
    savingRolesUserId !== null ||
    isRefreshing

  if (isLoading) return <p className="text-center text-ink-soft">Loading users...</p>

  return (
    <div className="cfca-page space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-ink">
            Administration
          </p>
          <h1 className="font-display text-4xl font-semibold text-ink">User Management</h1>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void loadUsers(true)}
          isLoading={isRefreshing}
          loadingText="Refreshing..."
          disabled={isBusy}
          aria-label="Refresh users list"
        >
          Refresh
        </Button>
      </div>

      {fetchedAt != null && (
        <p className="text-sm text-ink-soft">
          List data cached · updated {formatCacheAge(fetchedAt)} · {users.length} loaded
        </p>
      )}
      {loadError && (
        <p className="text-sm text-[color:var(--danger)]" role="alert">
          {loadError}
        </p>
      )}
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
                      className="flex items-center gap-2 text-sm text-ink"
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
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Users ({users.length})</CardTitle>
          <p className="text-sm text-ink-soft" aria-live="polite">
            Showing {rangeStart}–{rangeEnd} · Page {currentPage} of {totalPages} ·{" "}
            {DASHBOARD_PAGE_SIZE} per page
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
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
                {pageRows.map((u) => {
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
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-ink-soft">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || isBusy}
              aria-label="Previous page"
            >
              Previous
            </Button>
            <p className="text-sm text-ink-soft">
              Page {currentPage} of {totalPages}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || isBusy}
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

export default UsersPage
