"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useBusyCursor } from "@/hooks/use-busy-cursor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert } from "@/components/ui/alert"

const ResetPasswordForm = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  useBusyCursor(isLoading)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!token) {
      setError("Invalid reset link. Please request a new password reset.")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Reset failed")
        return
      }

      router.push("/login?reset=success")
    } catch {
      setError("Reset failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (!token) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="pt-6">
          <Alert variant="error">
            Invalid reset link. Please{" "}
            <Link href="/forgot-password" className="underline">
              request a new password reset
            </Link>
            .
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Reset Password</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={isLoading} className="space-y-4 border-0 p-0 m-0 min-w-0">
            {error && <Alert variant="error">{error}</Alert>}

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                aria-label="New password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                aria-label="Confirm new password"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              loadingText="Resetting..."
              disabled={isLoading}
            >
              Reset Password
            </Button>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  )
}

const ResetPasswordPage = () => (
  <Suspense fallback={<p className="text-center text-gray-500">Loading...</p>}>
    <ResetPasswordForm />
  </Suspense>
)

export default ResetPasswordPage
