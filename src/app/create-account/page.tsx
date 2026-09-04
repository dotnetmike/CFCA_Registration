"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/context"
import { useBusyCursor } from "@/hooks/use-busy-cursor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert } from "@/components/ui/alert"

const CreateAccountPage = () => {
  const { signup } = useAuth()
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  useBusyCursor(isLoading)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError("")
    setIsLoading(true)
    try {
      await signup(email, password, name)
      router.push("/my-registration")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account setup failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="cfca-auth-shell">
      <div className="mb-6 space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-ink">Account</p>
        <h1 className="font-display text-4xl font-semibold text-ink">Create your account</h1>
        <p className="text-sm text-ink-soft">Use the email from your existing conference registration.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Set your password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset disabled={isLoading} className="m-0 min-w-0 space-y-4 border-0 p-0">
              {error && <Alert variant="error">{error}</Alert>}
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Registration Email</Label>
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password (min 8 characters)</Label>
                <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="new-password" />
              </div>
              <Button type="submit" className="w-full" isLoading={isLoading} loadingText="Creating account..." disabled={isLoading}>
                Create account
              </Button>
            </fieldset>
          </form>
          <p className="mt-5 text-center text-sm text-ink-soft">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-ink underline-offset-4 hover:underline">Login</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default CreateAccountPage