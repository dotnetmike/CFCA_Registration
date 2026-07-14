"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth/context"

type NavItem = {
  href: string
  label: string
  match: (pathname: string) => boolean
  show: boolean
}

export const DashboardSubnav = () => {
  const { user } = useAuth()
  const pathname = usePathname()

  if (!user) return null

  const canReconcile = user.permissions.includes("payments:reconcile")
  const canManageUsers = user.permissions.includes("users:manage")

  const items: NavItem[] = [
    {
      href: "/dashboard",
      label: "Registrations",
      match: (p) => p === "/dashboard" || p.startsWith("/dashboard/registrations"),
      show: true,
    },
    {
      href: "/dashboard/reports",
      label: "Reports",
      match: (p) => p.startsWith("/dashboard/reports"),
      show: true,
    },
    {
      href: "/dashboard/payments/reconcile",
      label: "Payment Reconcile",
      match: (p) => p.startsWith("/dashboard/payments"),
      show: canReconcile,
    },
    {
      href: "/dashboard/users",
      label: "Users",
      match: (p) => p.startsWith("/dashboard/users"),
      show: canManageUsers,
    },
    {
      href: "/dashboard/audit",
      label: "Audit Log",
      match: (p) => p.startsWith("/dashboard/audit"),
      show: canManageUsers,
    },
  ]

  const visible = items.filter((item) => item.show)

  return (
    <nav
      aria-label="Dashboard submenu"
      className="flex flex-wrap gap-1 rounded-lg border border-[color:var(--line)] bg-surface/70 p-1.5 backdrop-blur-sm"
    >
      {visible.map((item) => {
        const isActive = item.match(pathname)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "rounded-md bg-ink px-3.5 py-2 text-sm font-semibold text-white transition-colors"
                : "rounded-md px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
            }
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
