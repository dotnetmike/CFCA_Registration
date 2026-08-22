"use client"

import Link from "next/link"
import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth/context"

type NavItem = {
  href: string
  label: string
  match: (pathname: string) => boolean
  show: boolean
}

type Indicator = {
  left: number
  width: number
}

export const DashboardSubnav = () => {
  const { user } = useAuth()
  const pathname = usePathname()
  const navRef = useRef<HTMLElement>(null)
  const itemRefs = useRef<Map<string, HTMLAnchorElement>>(new Map())
  const [indicator, setIndicator] = useState<Indicator | null>(null)

  const canReconcile = !!user?.permissions.includes("payments:reconcile")
  const canManageUsers = !!user?.permissions.includes("users:manage")

  const visible = useMemo(() => {
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
        href: "/dashboard/settings",
        label: "Registration Settings",
        match: (p) => p.startsWith("/dashboard/settings"),
        show: canManageUsers,
      },
      {
        href: "/dashboard/audit",
        label: "Audit Log",
        match: (p) => p.startsWith("/dashboard/audit"),
        show: canManageUsers,
      },
    ]
    return items.filter((item) => item.show)
  }, [canReconcile, canManageUsers])

  const activeHref = visible.find((item) => item.match(pathname))?.href ?? null

  useLayoutEffect(() => {
    if (!user || !activeHref || !navRef.current) {
      setIndicator(null)
      return
    }

    const el = itemRefs.current.get(activeHref)
    if (!el) {
      setIndicator(null)
      return
    }

    const update = () => {
      if (!navRef.current) return
      const navRect = navRef.current.getBoundingClientRect()
      const itemRect = el.getBoundingClientRect()
      setIndicator({
        left: itemRect.left - navRect.left,
        width: itemRect.width,
      })
    }

    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [user, activeHref, pathname, visible.length])

  if (!user) return null

  return (
    <nav
      ref={navRef}
      aria-label="Dashboard submenu"
      className="cfca-dashboard-subnav relative flex flex-wrap gap-1 rounded-xl border border-[color:var(--line)] bg-surface/80 p-1.5 shadow-[0_8px_24px_-18px_rgba(11,31,51,0.45)] backdrop-blur-md"
    >
      {indicator && (
        <span
          aria-hidden="true"
          className="cfca-dashboard-subnav__indicator pointer-events-none absolute top-1.5 bottom-1.5 rounded-lg bg-ink shadow-sm"
          style={{
            left: indicator.left,
            width: indicator.width,
          }}
        />
      )}
      {visible.map((item) => {
        const isActive = item.match(pathname)
        return (
          <Link
            key={item.href}
            href={item.href}
            ref={(node) => {
              if (node) itemRefs.current.set(item.href, node)
              else itemRefs.current.delete(item.href)
            }}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "relative z-10 rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition-colors duration-300"
                : "relative z-10 rounded-lg px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors duration-300 hover:bg-surface-muted/80 hover:text-ink"
            }
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
