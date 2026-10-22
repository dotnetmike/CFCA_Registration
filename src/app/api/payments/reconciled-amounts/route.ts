import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requirePermission } from "@/lib/auth/api"
import { reconciliationErrorResponse } from "@/lib/reconciliation/http"
import { loadReconciledAmounts } from "@/lib/reconciliation/service"

export const runtime = "nodejs"

export const GET = async (request: NextRequest) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const forbidden = requirePermission(auth, "registrations:read_all")
  if (forbidden) return forbidden

  try {
    return NextResponse.json(await loadReconciledAmounts())
  } catch (err) {
    return reconciliationErrorResponse(err)
  }
}
