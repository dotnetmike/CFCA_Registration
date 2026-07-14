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
      className="flex flex-wrap gap-1 border-b border-gray-200 pb-3"
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
                ? "rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800"
                : "rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-blue-700"
            }
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
