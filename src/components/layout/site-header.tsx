"use client"

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react"
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

  const handleDashKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
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
  const isRegistrationPage = pathname === "/" || pathname === "/register"

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--line)] bg-white/95 backdrop-blur-xl animate-fade">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1.35fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 py-3 md:gap-6 md:py-3.5">
        <Link
          href="/"
          className="cfca-brand-mark group justify-self-start"
          aria-label="Couples for Christ Australia — Conference Registration home"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/cfca-australia-mark.png"
            alt=""
            width={108}
            height={113}
            className="cfca-brand-mark__icon transition-opacity group-hover:opacity-90"
          />
          <span className="cfca-brand-mark__text">
            <span className="cfca-brand-mark__primary">Couples for Christ</span>
            <span className="cfca-brand-mark__secondary">Australia</span>
          </span>
        </Link>

        <p className="cfca-header-title">
          Conference Registration
        </p>

        <nav
          className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 justify-self-end"
          aria-label="Main navigation"
        >
          {!isLoading && user ? (
            <>
              <Link
                href="/my-registration"
                className="cfca-nav-link"
                aria-current={pathname.startsWith("/my-registration") ? "page" : undefined}
              >
                My Registration
              </Link>
              <Link
                href="/payment"
                className="cfca-nav-link"
                aria-current={pathname.startsWith("/payment") ? "page" : undefined}
              >
                Payment
              </Link>
              <Link
                href="/account"
                className="cfca-nav-link"
                aria-current={pathname.startsWith("/account") ? "page" : undefined}
              >
                Account
              </Link>
              {isManager(user) && (
                <div className="relative" ref={dashRef}>
                  <button
                    type="button"
                    className="cfca-nav-link inline-flex items-center gap-1"
                    aria-haspopup="menu"
                    aria-expanded={isDashOpen}
                    aria-controls="dashboard-submenu"
                    aria-label="Dashboard menu"
                    onClick={handleDashToggle}
                    onKeyDown={handleDashKeyDown}
                  >
                    Dashboard
                    <span
                      aria-hidden
                      className={`text-[0.65rem] transition-transform duration-200 ${isDashOpen ? "rotate-180" : ""}`}
                    >
                      ▾
                    </span>
                  </button>
                  {isDashOpen && (
                    <div
                      id="dashboard-submenu"
                      role="menu"
                      aria-label="Dashboard submenu"
                      className="absolute right-0 z-30 mt-3 min-w-[13rem] overflow-hidden rounded-lg border border-[color:var(--line)] bg-surface/95 py-1 shadow-[0_18px_40px_-24px_rgba(11,31,51,0.45)] backdrop-blur-md animate-rise"
                    >
                      {visibleDashLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          role="menuitem"
                          className="block px-3.5 py-2.5 text-sm text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
                          onClick={() => setIsDashOpen(false)}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <span className="hidden text-sm text-ink-soft/80 sm:inline">{user.name}</span>
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
          ) : !isRegistrationPage ? (
            <>
              <Link
                href="/login"
                className="cfca-nav-link"
                aria-current={pathname === "/login" ? "page" : undefined}
              >
                Login
              </Link>
              <Link href="/">
                <Button size="sm" aria-label="Register for conference">
                  Register
                </Button>
              </Link>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  )
}
