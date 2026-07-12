"use client"

import { useState } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/auth/context"
import { isManager } from "@/lib/auth/permissions-client"
import { useBusyCursor } from "@/hooks/use-busy-cursor"
import { Button } from "@/components/ui/button"

export const SiteHeader = () => {
  const { user, logout, isLoading } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  useBusyCursor(isLoggingOut)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await logout()
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-bold text-blue-700" aria-label="CFCA Conference Home">
          CFCA Conference Registration
        </Link>
        <nav className="flex items-center gap-4 text-sm" aria-label="Main navigation">
          {!isLoading && user ? (
            <>
              <Link href="/my-registration" className="hover:text-blue-600">My Registration</Link>
              <Link href="/payment" className="hover:text-blue-600">Payment</Link>
              <Link href="/account" className="hover:text-blue-600">Account</Link>
              {isManager(user) && (
                <Link href="/dashboard" className="hover:text-blue-600">Dashboard</Link>
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
              <Link href="/login" className="hover:text-blue-600">Login</Link>
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
