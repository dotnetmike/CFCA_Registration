import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requirePermission } from "@/lib/auth/api"
import { recheckUnmatched } from "@/lib/reconciliation/service"
import { reconciliationErrorResponse } from "@/lib/reconciliation/http"

export const runtime = "nodejs"

export const POST = async (request: NextRequest) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const forbidden = requirePermission(auth, "payments:reconcile")
  if (forbidden) return forbidden

  try {
    const run = await recheckUnmatched({ actorId: auth.sub, request })
    return NextResponse.json({ run })
  } catch (err) {
    return reconciliationErrorResponse(err)
  }
}
