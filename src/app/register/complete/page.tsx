"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useBusyCursor } from "@/hooks/use-busy-cursor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert } from "@/components/ui/alert"

const firstNameFrom = (fullName: string) => {
  const part = fullName.trim().split(/\s+/)[0]
  return part || "friend"
}

const CongratulationsHero = ({
  displayName,
  viewToken,
}: {
  displayName: string
  viewToken: string
}) => (
  <section className="space-y-4 text-center" aria-labelledby="congrats-heading">
    <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
      Registration confirmed
    </p>
    <h1 id="congrats-heading" className="text-4xl font-bold tracking-tight text-gray-900 md:text-5xl">
      Congratulations, {firstNameFrom(displayName)}!
    </h1>
    <p className="mx-auto max-w-xl text-lg text-gray-700 md:text-xl">
      Welcome to the CFCA Conference. We are looking forward to seeing you there.
    </p>
    <p className="mx-auto max-w-lg text-sm text-gray-600">
      A confirmation email with your registration details
      {viewToken ? (
        <>
          {" "}
          and a{" "}
          <Link
            href={`/r/${encodeURIComponent(viewToken)}`}
            className="font-medium text-blue-600 hover:underline"
          >
            direct link to view your registration
          </Link>
        </>
      ) : null}{" "}
      has been sent to you.
    </p>
  </section>
)

const CompleteForm = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const signupToken = searchParams.get("token") ?? ""
  const viewToken = searchParams.get("view") ?? ""

  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [skipped, setSkipped] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  useBusyCursor(isLoading)

  useEffect(() => {
    if (!signupToken) {
      setIsBootstrapping(false)
      return
    }

    const load = async () => {
      const res = await fetch(`/api/registrations/signup/${encodeURIComponent(signupToken)}`)
      if (res.ok) {
        const data = await res.json()
        setEmail(data.email ?? "")
        setName(data.name ?? "")
        if (data.alreadyLinked) {
          router.replace("/login?redirect=/my-registration")
          return
        }
      } else {
        setError(
          "This signup link is invalid or has expired. You can still view your registration from the confirmation email."
        )
      }
      setIsBootstrapping(false)
    }

    load()
  }, [signupToken, router])

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/register-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          signupToken,
          password,
          name,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to create account")
        return
      }

      window.location.assign("/my-registration")
    } catch {
      setError("Failed to create account")
    } finally {
      setIsLoading(false)
    }
  }

  if (isBootstrapping) {
    return <p className="text-center text-gray-500">Loading...</p>
  }

  const displayName = name || "friend"

  if (skipped) {
    return (
      <div className="mx-auto max-w-2xl space-y-8">
        <CongratulationsHero displayName={displayName} viewToken={viewToken} />
        <div className="space-y-4 text-center">
          <p className="text-sm text-gray-600">
            To edit your registration later,{" "}
            <Link
              href={
                email
                  ? `/signup?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent("/my-registration")}`
                  : "/"
              }
              className="text-blue-600 hover:underline"
            >
              create an account
            </Link>{" "}
            using the same email, or{" "}
            <Link href="/login" className="text-blue-600 hover:underline">
              log in
            </Link>
            .
          </p>
          <Link href="/">
            <Button variant="outline">Back to home</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <CongratulationsHero displayName={displayName} viewToken={viewToken} />

      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Create your account
          </CardTitle>
          <p className="text-sm font-normal text-gray-600">
            Optional — set a password so you can log in later to edit your registration and view
            payment details.
          </p>
        </CardHeader>
        <CardContent>
          {!signupToken ? (
            <Alert variant="warning">
              Missing signup token. Check your confirmation email for a view link, or{" "}
              <Link href="/" className="underline">
                go to registration
              </Link>
              .
            </Alert>
          ) : (
            <form onSubmit={handleCreateAccount} className="space-y-4">
              <fieldset disabled={isLoading} className="m-0 min-w-0 space-y-4 border-0 p-0">
                {error && <Alert variant="error">{error}</Alert>}

                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
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
                    readOnly
                    className="bg-gray-50"
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
                    minLength={8}
                    autoComplete="new-password"
                    aria-label="Password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    aria-label="Confirm password"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  isLoading={isLoading}
                  loadingText="Creating account..."
                  disabled={isLoading}
                >
                  Create account
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setSkipped(true)}
                  disabled={isLoading}
                >
                  Skip for now
                </Button>
              </fieldset>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const RegisterCompletePage = () => (
  <Suspense fallback={<p className="text-center text-gray-500">Loading...</p>}>
    <CompleteForm />
  </Suspense>
)

export default RegisterCompletePage
