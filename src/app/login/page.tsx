"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth/context"
import { useBusyCursor } from "@/hooks/use-busy-cursor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert } from "@/components/ui/alert"

const LoginForm = () => {
  const { login } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") ?? "/my-registration"
  const resetSuccess = searchParams.get("reset") === "success"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  useBusyCursor(isLoading)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    try {
      await login(email, password)
      router.push(redirect)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="cfca-auth-shell">
      <div className="mb-6 space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-ink">
          Member access
        </p>
        <h1 className="font-display text-4xl font-semibold text-ink">Welcome back</h1>
        <p className="text-sm text-ink-soft">
          Sign in to view your registration and payment details.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset disabled={isLoading} className="m-0 min-w-0 space-y-4 border-0 p-0">
              {resetSuccess && (
                <Alert variant="success">
                  Your password has been reset. You can log in now.
                </Alert>
              )}
              {error && <Alert variant="error">{error}</Alert>}
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
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  aria-label="Password"
                />
              </div>
              <p className="text-right text-sm">
                <Link
                  href="/forgot-password"
                  className="font-medium text-accent-ink transition-colors hover:text-ink"
                >
                  Forgot password?
                </Link>
              </p>
              <Button
                type="submit"
                className="w-full"
                isLoading={isLoading}
                loadingText="Logging in..."
                disabled={isLoading}
              >
                Login
              </Button>
            </fieldset>
          </form>
          <p className="mt-5 text-center text-sm text-ink-soft">
            Haven&apos;t registered yet?{" "}
            <Link href="/" className="font-semibold text-ink underline-offset-4 hover:underline">
              Click here to register
            </Link>
          </p>
          <p className="mt-3 text-center text-sm text-ink-soft">
            Already registered but need an account?{" "}
            <Link
              href="/create-account"
              className="font-semibold text-ink underline-offset-4 hover:underline"
            >
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

const LoginPage = () => (
  <Suspense fallback={<p className="text-center text-ink-soft">Loading...</p>}>
    <LoginForm />
  </Suspense>
)

export default LoginPage
