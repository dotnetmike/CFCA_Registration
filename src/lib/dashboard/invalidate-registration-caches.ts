import { reconciledAmountsCache } from "@/lib/dashboard/reconciled-amounts-cache"
import { clearDashboardRegistrationsCache } from "@/lib/dashboard/registrations-list-cache"
import { reportsCache } from "@/lib/dashboard/reports-cache"

/**
 * Call after any change to registration or payment data so the Registrations Dashboard and Reports
 * fetch fresh data on their next visit instead of showing their cached copy (TTL 5 minutes).
 */
export const invalidateRegistrationCaches = () => {
  clearDashboardRegistrationsCache()
  reportsCache.clear()
  reconciledAmountsCache.clear()
}
