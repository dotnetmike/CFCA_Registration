import { createDashboardValueCache } from "@/lib/dashboard/list-cache"

export type ReportsSummary = Record<
  string,
  { attendees: number; spouses: number; kids: number; registrations: number }
>

export type ReportsCacheValue = {
  summary: ReportsSummary
  total: number
}

export const reportsCache = createDashboardValueCache<ReportsCacheValue>({
  storageKey: "cfca.dashboard.reports.v1",
})
