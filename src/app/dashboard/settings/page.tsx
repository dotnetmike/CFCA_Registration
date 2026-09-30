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
  registrationStartDate: string
  registrationEndDate: string
  pricing: {
    earlyBirdStart: string
    earlyBirdEnd: string
    earlyBirdPaymentDueDate: string
    adultEarlyBird: number
    adultRegular: number
    age12Plus: number
    age2To12: number
    earlyBirdInterstateLimit: number
    earlyBirdVicLimit: number
  }
  paymentReminderDates: string[]
  notificationRecipientEmail: string
  registrationWorkflow: "v1" | "v2"
}

const emptySettings: Settings = {
  registrationOpen: true,
  registrationStartDate: "",
  registrationEndDate: "",
  pricing: {
    earlyBirdStart: "",
    earlyBirdEnd: "",
    earlyBirdPaymentDueDate: "",
    adultEarlyBird: 0,
    adultRegular: 0,
    age12Plus: 0,
    age2To12: 0,
    earlyBirdInterstateLimit: 200,
    earlyBirdVicLimit: 250,
  },
  paymentReminderDates: [],
  notificationRecipientEmail: "",
  registrationWorkflow: "v1",
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
    setSettings({
      ...emptySettings,
      ...(data.settings as Settings),
      registrationWorkflow:
        (data.settings as Settings)?.registrationWorkflow === "v2" ? "v2" : "v1",
    })
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
          key === "earlyBirdStart" || key === "earlyBirdEnd" || key === "earlyBirdPaymentDueDate"
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
    setSettings({
      ...emptySettings,
      ...(data.settings as Settings),
      registrationWorkflow:
        (data.settings as Settings)?.registrationWorkflow === "v2" ? "v2" : "v1",
    })
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
              <CardTitle>Registration payment workflow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <fieldset className="space-y-3">
                <legend className="sr-only">Registration payment workflow</legend>
                <label className="flex items-start gap-3 text-sm text-ink">
                  <input
                    type="radio"
                    name="registrationWorkflow"
                    value="v1"
                    checked={settings.registrationWorkflow === "v1"}
                    onChange={() =>
                      setSettings((current) => ({
                        ...current,
                        registrationWorkflow: "v1",
                      }))
                    }
                    aria-label="V1 Classic registration workflow"
                  />
                  <span>
                    <strong>V1 — Classic</strong> (default): Submit registration, then pay by
                    bank transfer on the payment page.
                  </span>
                </label>
                <label className="flex items-start gap-3 text-sm text-ink">
                  <input
                    type="radio"
                    name="registrationWorkflow"
                    value="v2"
                    checked={settings.registrationWorkflow === "v2"}
                    onChange={() =>
                      setSettings((current) => ({
                        ...current,
                        registrationWorkflow: "v2",
                      }))
                    }
                    aria-label="V2 Online payment capability workflow"
                  />
                  <span>
                    <strong>V2 — Online payment capability</strong>: After submit, show a
                    payment step (bank transfer and online card/wallets via Stripe when
                    configured).
                  </span>
                </label>
              </fieldset>
              <p className="text-xs text-ink-soft">
                Leave V1 until online payment is signed off. Flip to V2 here when ready;
                switch back to V1 anytime to roll back the public flow.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Registration Availability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  aria-label="Enable registration"
                />
                <span>
                  <strong>Enable registration (force override)</strong>. Uncheck to force registration closed immediately regardless of set dates.
                </span>
              </label>

              <div className="grid gap-4 md:grid-cols-2 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="registrationStartDate">Opening date</Label>
                  <Input
                    id="registrationStartDate"
                    type="date"
                    value={settings.registrationStartDate}
                    onChange={(e) =>
                      setSettings((current) => ({
                        ...current,
                        registrationStartDate: e.target.value,
                      }))
                    }
                    aria-label="Registration opening date"
                  />
                  <p className="text-xs text-ink-soft">
                    Registration automatically opens on this date.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registrationEndDate">Closing date</Label>
                  <Input
                    id="registrationEndDate"
                    type="date"
                    value={settings.registrationEndDate}
                    onChange={(e) =>
                      setSettings((current) => ({
                        ...current,
                        registrationEndDate: e.target.value,
                      }))
                    }
                    aria-label="Registration closing date"
                  />
                  <p className="text-xs text-ink-soft">
                    Registration automatically closes after this date.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Early Bird Window & Capacity Limits</CardTitle>
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
                <Label htmlFor="earlyBirdPaymentDueDate">Payment due date</Label>
                <Input
                  id="earlyBirdPaymentDueDate"
                  type="date"
                  value={settings.pricing.earlyBirdPaymentDueDate}
                  onChange={(e) => updatePricing("earlyBirdPaymentDueDate", e.target.value)}
                  aria-label="Early bird payment due date"
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
              <div className="space-y-2 md:col-span-2 grid gap-4 md:grid-cols-2 pt-2 border-t">
                <div className="space-y-2">
                  <Label htmlFor="earlyBirdInterstateLimit">Interstate delegates early bird cap</Label>
                  <Input
                    id="earlyBirdInterstateLimit"
                    type="number"
                    min={0}
                    value={settings.pricing.earlyBirdInterstateLimit}
                    onChange={(e) => updatePricing("earlyBirdInterstateLimit", e.target.value)}
                    aria-label="Interstate delegates early bird cap"
                  />
                  <p className="text-xs text-ink-soft">Default: 200</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="earlyBirdVicLimit">Victoria delegates early bird cap</Label>
                  <Input
                    id="earlyBirdVicLimit"
                    type="number"
                    min={0}
                    value={settings.pricing.earlyBirdVicLimit}
                    onChange={(e) => updatePricing("earlyBirdVicLimit", e.target.value)}
                    aria-label="Victoria delegates early bird cap"
                  />
                  <p className="text-xs text-ink-soft">Default: 250</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Reminders</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="paymentReminderDates">Reminder dates</Label>
                <Input
                  id="paymentReminderDates"
                  type="text"
                  value={settings.paymentReminderDates.join(", ")}
                  onChange={(e) => setSettings((current) => ({
                    ...current,
                    paymentReminderDates: e.target.value.split(",").map((date) => date.trim()).filter(Boolean),
                  }))}
                  placeholder="YYYY-MM-DD, YYYY-MM-DD"
                  aria-label="Payment reminder dates"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Registration Updates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notificationRecipientEmail">Registration updates email</Label>
                <Input
                  id="notificationRecipientEmail"
                  type="email"
                  value={settings.notificationRecipientEmail}
                  onChange={(e) => setSettings((current) => ({
                    ...current,
                    notificationRecipientEmail: e.target.value,
                  }))}
                  placeholder="registrations@example.org"
                  aria-label="Registration updates email"
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
