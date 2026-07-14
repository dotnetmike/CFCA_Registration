"use client"

import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth/context"
import { isManager } from "@/lib/auth/permissions-client"
import { useBusyCursor } from "@/hooks/use-busy-cursor"
import { Button } from "@/components/ui/button"

type DashLink = {
  href: string
  label: string
  show: boolean
}

export const SiteHeader = () => {
  const { user, logout, isLoading } = useAuth()
  const pathname = usePathname()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isDashOpen, setIsDashOpen] = useState(false)
  const dashRef = useRef<HTMLDivElement>(null)
  useBusyCursor(isLoggingOut)

  useEffect(() => {
    setIsDashOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!isDashOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!dashRef.current?.contains(event.target as Node)) {
        setIsDashOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsDashOpen(false)
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isDashOpen])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await logout()
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleDashToggle = () => {
    setIsDashOpen((open) => !open)
  }

  const handleDashKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      setIsDashOpen(true)
    }
  }

  const dashLinks: DashLink[] = user
    ? [
        { href: "/dashboard", label: "Registrations", show: true },
        { href: "/dashboard/reports", label: "Reports", show: true },
        {
          href: "/dashboard/payments/reconcile",
          label: "Payment Reconcile",
          show: user.permissions.includes("payments:reconcile"),
        },
        {
          href: "/dashboard/users",
          label: "Users",
          show: user.permissions.includes("users:manage"),
        },
        {
          href: "/dashboard/audit",
          label: "Audit Log",
          show: user.permissions.includes("users:manage"),
        },
      ]
    : []

  const visibleDashLinks = dashLinks.filter((link) => link.show)

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-bold text-blue-700" aria-label="CFCA Conference Home">
          CFCA Conference Registration
        </Link>
        <nav className="flex items-center gap-4 text-sm" aria-label="Main navigation">
          {!isLoading && user ? (
            <>
              <Link href="/my-registration" className="hover:text-blue-600">
                My Registration
              </Link>
              <Link href="/payment" className="hover:text-blue-600">
                Payment
              </Link>
              <Link href="/account" className="hover:text-blue-600">
                Account
              </Link>
              {isManager(user) && (
                <div className="relative" ref={dashRef}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-blue-600"
                    aria-haspopup="menu"
                    aria-expanded={isDashOpen}
                    aria-controls="dashboard-submenu"
                    aria-label="Dashboard menu"
                    onClick={handleDashToggle}
                    onKeyDown={handleDashKeyDown}
                  >
                    Dashboard
                    <span aria-hidden className="text-xs">
                      ▾
                    </span>
                  </button>
                  {isDashOpen && (
                    <div
                      id="dashboard-submenu"
                      role="menu"
                      aria-label="Dashboard submenu"
                      className="absolute right-0 z-30 mt-2 min-w-[12rem] rounded-md border border-gray-200 bg-white py-1"
                    >
                      {visibleDashLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          role="menuitem"
                          className="block px-3 py-2 text-sm text-gray-800 hover:bg-blue-50 hover:text-blue-800"
                          onClick={() => setIsDashOpen(false)}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <span className="text-gray-500">{user.name}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                isLoading={isLoggingOut}
                loadingText="Logging out..."
                disabled={isLoggingOut}
                aria-label="Log out"
              >
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-blue-600">
                Login
              </Link>
              <Link href="/">
                <Button size="sm">Register</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
