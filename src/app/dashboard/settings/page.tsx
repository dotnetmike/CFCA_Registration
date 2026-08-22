"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert } from "@/components/ui/alert"
import { useBusyCursor } from "@/hooks/use-busy-cursor"

type Settings = {
  registrationOpen: boolean
  pricing: {
    earlyBirdStart: string
    earlyBirdEnd: string
    adultEarlyBird: number
    adultRegular: number
    age12Plus: number
    age2To12: number
  }
}

const emptySettings: Settings = {
  registrationOpen: true,
  pricing: {
    earlyBirdStart: "",
    earlyBirdEnd: "",
    adultEarlyBird: 0,
    adultRegular: 0,
    age12Plus: 0,
    age2To12: 0,
  },
}

const RegistrationSettingsPage = () => {
  const { user, authFetch } = useAuth()
  const router = useRouter()
  const [settings, setSettings] = useState<Settings>(emptySettings)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  useBusyCursor(isSaving)

  const loadSettings = useCallback(async () => {
    setError("")
    const res = await authFetch("/api/admin/registration-settings")
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? "Could not load settings")
      setIsLoading(false)
      return
    }

    const data = await res.json()
    setSettings(data.settings as Settings)
    setIsLoading(false)
  }, [authFetch])

  useEffect(() => {
    if (!user) return
    if (!user.permissions.includes("users:manage")) {
      router.push("/dashboard")
      return
    }
    void loadSettings()
  }, [user, router, loadSettings])

  const updatePricing = (key: keyof Settings["pricing"], value: string) => {
    setSettings((current) => ({
      ...current,
      pricing: {
        ...current.pricing,
        [key]:
          key === "earlyBirdStart" || key === "earlyBirdEnd"
            ? value
            : Number(value),
      },
    }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    setIsSaving(true)
    const res = await authFetch("/api/admin/registration-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? "Could not save settings")
      setIsSaving(false)
      return
    }

    const data = await res.json()
    setSettings(data.settings as Settings)
    setSuccess("Registration settings updated")
    setIsSaving(false)
  }

  if (isLoading) return <p className="text-center text-ink-soft">Loading settings...</p>

  return (
    <div className="cfca-page space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-ink">
          Administration
        </p>
        <h1 className="font-display text-4xl font-semibold text-ink">Registration Settings</h1>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <form onSubmit={handleSave} className="space-y-6">
        <fieldset disabled={isSaving} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Registration Availability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-start gap-3 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={settings.registrationOpen}
                  onChange={(e) =>
                    setSettings((current) => ({
                      ...current,
                      registrationOpen: e.target.checked,
                    }))
                  }
                  aria-label="Registration open"
                />
                <span>
                  Registration is open to participants. When off, guests/participants will see a
                  closed notice page.
                </span>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Early Bird Window</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="earlyBirdStart">Start date</Label>
                <Input
                  id="earlyBirdStart"
                  type="date"
                  value={settings.pricing.earlyBirdStart}
                  onChange={(e) => updatePricing("earlyBirdStart", e.target.value)}
                  aria-label="Early bird start date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="earlyBirdEnd">End date</Label>
                <Input
                  id="earlyBirdEnd"
                  type="date"
                  value={settings.pricing.earlyBirdEnd}
                  onChange={(e) => updatePricing("earlyBirdEnd", e.target.value)}
                  aria-label="Early bird end date"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attendee Pricing (AUD)</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="adultEarlyBird">Adult early bird</Label>
                <Input
                  id="adultEarlyBird"
                  type="number"
                  min={0}
                  step="0.01"
                  value={settings.pricing.adultEarlyBird}
                  onChange={(e) => updatePricing("adultEarlyBird", e.target.value)}
                  aria-label="Adult early bird price"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adultRegular">Adult regular</Label>
                <Input
                  id="adultRegular"
                  type="number"
                  min={0}
                  step="0.01"
                  value={settings.pricing.adultRegular}
                  onChange={(e) => updatePricing("adultRegular", e.target.value)}
                  aria-label="Adult regular price"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="age12Plus">Child aged 12+</Label>
                <Input
                  id="age12Plus"
                  type="number"
                  min={0}
                  step="0.01"
                  value={settings.pricing.age12Plus}
                  onChange={(e) => updatePricing("age12Plus", e.target.value)}
                  aria-label="Child 12 plus price"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="age2To12">Child aged 2 to 12</Label>
                <Input
                  id="age2To12"
                  type="number"
                  min={0}
                  step="0.01"
                  value={settings.pricing.age2To12}
                  onChange={(e) => updatePricing("age2To12", e.target.value)}
                  aria-label="Child 2 to 12 price"
                />
              </div>
            </CardContent>
          </Card>

          <div>
            <Button
              type="submit"
              isLoading={isSaving}
              loadingText="Saving settings..."
              disabled={isSaving}
              aria-label="Save registration settings"
            >
              Save Settings
            </Button>
          </div>
        </fieldset>
      </form>
    </div>
  )
}

export default RegistrationSettingsPage
