"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useBusyCursor } from "@/hooks/use-busy-cursor"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"

type ReconcileResult = {
  statementId: string
  matched: number
  unmatched: number
  results: { reference: string; amount: number; matchStatus: string }[]
}

const ReconcilePage = () => {
  const { user, authFetch } = useAuth()
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  useBusyCursor(isUploading)
  const [result, setResult] = useState<ReconcileResult | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!user) return
    if (!user.permissions.includes("payments:reconcile")) {
      router.push("/dashboard")
    }
  }, [user, router])

  const handleUpload = async () => {
    if (!file) return
    setError("")
    setIsUploading(true)

    const formData = new FormData()
    formData.append("file", file)

    const res = await authFetch("/api/payments/reconcile", {
      method: "POST",
      body: formData,
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? "Upload failed")
    } else {
      setResult(await res.json())
    }
    setIsUploading(false)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Payment Reconciliation</h1>

      <Card>
        <CardHeader>
          <CardTitle>Upload Bank Statement (PDF)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Upload a bank statement PDF. The system will scan for registration numbers (e.g. CFCA26-000001) and auto-match payments.
          </p>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            aria-label="Select bank statement PDF"
            className="text-sm"
          />
          <Button
            onClick={handleUpload}
            isLoading={isUploading}
            loadingText="Processing..."
            disabled={!file || isUploading}
            aria-label="Upload and reconcile"
          >
            Upload & Reconcile
          </Button>
        </CardContent>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Matched: <strong>{result.matched}</strong></p>
            <p>Unmatched: <strong>{result.unmatched}</strong></p>
            <ul className="mt-4 space-y-1">
              {result.results.map((r, i) => (
                <li key={i} className={r.matchStatus === "auto_matched" ? "text-green-700" : "text-amber-700"}>
                  {r.reference} — ${r.amount.toFixed(2)} — {r.matchStatus}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default ReconcilePage
