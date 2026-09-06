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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const dashRef = useRef<HTMLDivElement>(null)
  useBusyCursor(isLoggingOut)

  useEffect(() => {
    setIsDashOpen(false)
    setIsMobileMenuOpen(false)
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
          href: "/dashboard/settings",
          label: "Registration Settings",
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
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:grid md:grid-cols-[minmax(0,1.35fr)_auto_minmax(0,1fr)] md:items-center md:gap-6 md:py-3.5">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="cfca-brand-mark group"
            aria-label="Couples for Christ Australia — Conference Registration home"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/cfca-logo-official.jpg"
              alt="Couples for Christ Australia"
              width={220}
              height={78}
              className="h-14 w-auto object-contain transition-opacity group-hover:opacity-90 md:h-20"
            />
          </Link>

          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-[color:var(--line)] p-2 text-ink transition-colors hover:bg-surface-muted md:hidden"
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((open) => !open)}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isMobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        <div className="cfca-header-title" aria-label="National Conference 2027">
          <span>National Conference 2027</span>
          <span>9-11 April, 2027</span>
          <span>Melton Entertainment Park</span>
          <span>2 Ferris Road, Melton, Victoria</span>
        </div>

        <nav
          className="hidden md:flex md:flex-wrap md:items-center md:justify-end md:gap-x-5 md:gap-y-2 md:justify-self-end"
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
              <Link
                href="/create-account"
                className="cfca-nav-link"
                aria-current={pathname === "/create-account" ? "page" : undefined}
              >
                Create Account
              </Link>
              <Link href="/">
                <Button size="sm" aria-label="Register for conference">
                  Register
                </Button>
              </Link>
            </>
          ) : null}
        </nav>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <nav className="flex flex-col gap-3 rounded-xl border border-[color:var(--line)] bg-surface p-4 shadow-lg md:hidden animate-rise">
            {!isLoading && user ? (
              <>
                <div className="pb-2 border-b text-sm font-semibold text-ink">
                  Signed in as {user.name}
                </div>
                <Link
                  href="/my-registration"
                  className="px-2 py-1 text-base font-medium text-ink hover:text-blue-600"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  My Registration
                </Link>
                <Link
                  href="/payment"
                  className="px-2 py-1 text-base font-medium text-ink hover:text-blue-600"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Payment
                </Link>
                <Link
                  href="/account"
                  className="px-2 py-1 text-base font-medium text-ink hover:text-blue-600"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Account
                </Link>

                {isManager(user) && (
                  <div className="space-y-1 pl-2 border-l-2 border-blue-500 my-1">
                    <div className="px-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">
                      Dashboard
                    </div>
                    {visibleDashLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="block px-2 py-1 text-sm font-medium text-ink-soft hover:text-ink"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-center"
                    onClick={handleLogout}
                    isLoading={isLoggingOut}
                    loadingText="Logging out..."
                    disabled={isLoggingOut}
                    aria-label="Log out"
                  >
                    Logout
                  </Button>
                </div>
              </>
            ) : !isRegistrationPage ? (
              <>
                <Link
                  href="/login"
                  className="px-2 py-1 text-base font-medium text-ink hover:text-blue-600"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Login
                </Link>
                <Link
                  href="/create-account"
                  className="px-2 py-1 text-base font-medium text-ink hover:text-blue-600"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Create Account
                </Link>
                <Link href="/" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button size="sm" className="w-full justify-center" aria-label="Register for conference">
                    Register
                  </Button>
                </Link>
              </>
            ) : null}
          </nav>
        )}
      </div>
    </header>
  )
}
