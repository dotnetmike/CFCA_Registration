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
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Set up your account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="info">
            Account setup is only available after you have registered for the conference.
            Register first, then create a password from the confirmation page or magic link.
          </Alert>
          <Link href="/">
            <Button className="w-full" aria-label="Go to registration">
              Go to registration
            </Button>
          </Link>
          <p className="text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-600 hover:underline">Login</Link>
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Set up your account</CardTitle>
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
                className={emailFromQuery ? "bg-gray-50" : undefined}
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
        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link
            href={`/login?redirect=${encodeURIComponent(redirect)}`}
            className="text-blue-600 hover:underline"
          >
            Login
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

const SignupPage = () => (
  <Suspense fallback={<p className="text-center text-gray-500">Loading...</p>}>
    <SignupForm />
  </Suspense>
)

export default SignupPage
