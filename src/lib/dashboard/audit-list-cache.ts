import { createDashboardListCache } from "@/lib/dashboard/list-cache"

export type DashboardAuditRow = {
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

export const auditListCache = createDashboardListCache<DashboardAuditRow>({
  storageKey: "cfca.dashboard.audit.v1",
})
