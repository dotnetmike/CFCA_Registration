"use client"

import { useState } from "react"
import Link from "next/link"
import { useBusyCursor } from "@/hooks/use-busy-cursor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert } from "@/components/ui/alert"

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  useBusyCursor(isLoading)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setMessage("")
    setIsLoading(true)

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Request failed")
        return
      }

      setMessage(data.message)
    } catch {
      setError("Request failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Forgot Password</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={isLoading} className="space-y-4 border-0 p-0 m-0 min-w-0">
            <p className="text-sm text-gray-600">
              Enter your email address and we will send you a link to reset your password.
            </p>
            {error && <Alert variant="error">{error}</Alert>}
            {message && <Alert variant="success">{message}</Alert>}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                aria-label="Email address"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              loadingText="Sending..."
              disabled={isLoading}
            >
              Send Reset Link
            </Button>
          </fieldset>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          <Link href="/login" className="text-blue-600 hover:underline">
            Back to login
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

export default ForgotPasswordPage
