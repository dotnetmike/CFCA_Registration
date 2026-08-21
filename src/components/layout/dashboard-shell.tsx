"use client"

import { usePathname } from "next/navigation"
import { DashboardSubnav } from "@/components/layout/dashboard-subnav"

type DashboardShellProps = {
  children: React.ReactNode
}

export const DashboardShell = ({ children }: DashboardShellProps) => {
  const pathname = usePathname()

  return (
    <div className="cfca-dashboard-shell">
      <div className="cfca-dashboard-nav">
        <DashboardSubnav />
      </div>
      <div
        key={pathname}
        className="cfca-dashboard-panel"
        aria-live="polite"
      >
        {children}
      </div>
    </div>
  )
}
