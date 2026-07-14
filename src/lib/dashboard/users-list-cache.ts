import { createDashboardListCache } from "@/lib/dashboard/list-cache"

export type DashboardUserRow = {
  id: string
  email: string
  name: string
  is_active: boolean
  created_at?: string
  groups: string[]
}

export const usersListCache = createDashboardListCache<DashboardUserRow>({
  storageKey: "cfca.dashboard.users.v1",
})
