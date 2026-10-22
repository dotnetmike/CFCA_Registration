import { createDashboardValueCache } from "@/lib/dashboard/list-cache"
import type { ReconciledAmount } from "@/lib/reconciliation/types"

export const reconciledAmountsCache = createDashboardValueCache<Record<string, ReconciledAmount>>({
  storageKey: "cfca.dashboard.reconciled.v1",
})
