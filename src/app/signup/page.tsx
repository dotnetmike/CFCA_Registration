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

const SignupForm = () => {
  const { signup } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") ?? "/my-registration"
  const emailFromQuery = searchParams.get("email") ?? ""
  const hasLinkContext = !!emailFromQuery

  const [name, setName] = useState("")
  const [email, setEmail] = useState(emailFromQuery)
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  useBusyCursor(isLoading)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasLinkContext) return
    setError("")
    setIsLoading(true)
    try {
      await signup(email, password, name)
      router.push(redirect)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account setup failed")
    } finally {
      setIsLoading(false)
    }
  }

  if (!hasLinkContext) {
    return (
      <div className="cfca-auth-shell">
        <div className="mb-6 space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-ink">
            Account
          </p>
          <h1 className="font-display text-4xl font-semibold text-ink">Set up your account</h1>
        </div>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Alert variant="info">
              Account setup is only available after you have registered for the conference.
              Register first, then create a password from the confirmation page or magic link.
            </Alert>
            <Link href="/">
              <Button className="w-full" aria-label="Go to registration">
                Go to registration
              </Button>
            </Link>
            <p className="text-center text-sm text-ink-soft">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-ink underline-offset-4 hover:underline">
                Login
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="cfca-auth-shell">
      <div className="mb-6 space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-ink">
          Account
        </p>
        <h1 className="font-display text-4xl font-semibold text-ink">Set up your account</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Create password</CardTitle>
        </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={isLoading} className="m-0 min-w-0 space-y-4 border-0 p-0">
            {error && <Alert variant="error">{error}</Alert>}
            <Alert variant="info">
              Create a password for this email to edit your existing registration later.
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                aria-label="Full name"
              />
            </div>
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
                readOnly={!!emailFromQuery}
                className={emailFromQuery ? "bg-surface-muted" : undefined}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password (min 8 characters)</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                aria-label="Password"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              loadingText="Creating account..."
              disabled={isLoading}
            >
              Create password
            </Button>
          </fieldset>
        </form>
        <p className="mt-4 text-center text-sm text-ink-soft">
          Already have an account?{" "}
          <Link
            href={`/login?redirect=${encodeURIComponent(redirect)}`}
            className="font-semibold text-ink underline-offset-4 hover:underline"
          >
            Login
          </Link>
        </p>
      </CardContent>
    </Card>
    </div>
  )
}

const SignupPage = () => (
  <Suspense fallback={<p className="text-center text-ink-soft">Loading...</p>}>
    <SignupForm />
  </Suspense>
)

export default SignupPage
