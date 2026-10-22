import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requirePermission, jsonError } from "@/lib/auth/api"
import { reconciliationErrorResponse } from "@/lib/reconciliation/http"
import {
  importBankCsv,
  importStripeCsv,
  loadReconciliationOverview,
} from "@/lib/reconciliation/service"

export const runtime = "nodejs"

const MAX_FILE_BYTES = 5 * 1024 * 1024

const isCsvFile = (file: File) =>
  file.name.toLowerCase().endsWith(".csv") ||
  ["text/csv", "application/vnd.ms-excel", "text/plain"].includes(file.type)

export const GET = async (request: NextRequest) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const forbidden = requirePermission(auth, "payments:reconcile")
  if (forbidden) return forbidden

  try {
    return NextResponse.json(await loadReconciliationOverview())
  } catch (err) {
    return reconciliationErrorResponse(err)
  }
}

export const POST = async (request: NextRequest) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const forbidden = requirePermission(auth, "payments:reconcile")
  if (forbidden) return forbidden

  const formData = await request.formData().catch(() => null)
  const file = formData?.get("file")
  const source = formData?.get("source")
  if (!(file instanceof File)) return jsonError("Choose a CSV file to upload.")
  if (source !== "stripe" && source !== "bank") return jsonError("Unknown upload type.")
  if (!isCsvFile(file)) return jsonError("Only CSV files are accepted.")
  if (file.size > MAX_FILE_BYTES) return jsonError("File too large (max 5 MB).")

  const params = { text: await file.text(), filename: file.name, actorId: auth.sub, request }
  try {
    const run = source === "stripe" ? await importStripeCsv(params) : await importBankCsv(params)
    return NextResponse.json({ run })
  } catch (err) {
    return reconciliationErrorResponse(err)
  }
}
