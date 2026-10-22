import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, requirePermission, jsonError } from "@/lib/auth/api"
import { loadItemHistory, overrideReconciliationItem } from "@/lib/reconciliation/service"
import { reconciliationErrorResponse } from "@/lib/reconciliation/http"
import { RECONCILIATION_STATUSES } from "@/lib/reconciliation/types"

export const runtime = "nodejs"

const overrideSchema = z.object({
  itemType: z.enum(["stripe", "bank"]),
  itemId: z.string().uuid(),
  status: z.enum(RECONCILIATION_STATUSES),
  registrationId: z.string().uuid().nullish(),
  payoutId: z.string().min(1).max(100).nullish(),
  comment: z.string().max(1000),
})

const historyQuerySchema = z.object({
  itemType: z.enum(["stripe", "bank"]),
  itemId: z.string().uuid(),
})

export const GET = async (request: NextRequest) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const forbidden = requirePermission(auth, "payments:reconcile")
  if (forbidden) return forbidden

  const parsed = historyQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries())
  )
  if (!parsed.success) return jsonError("Invalid history request.")

  try {
    const events = await loadItemHistory(parsed.data.itemType, parsed.data.itemId)
    return NextResponse.json({ events })
  } catch (err) {
    return reconciliationErrorResponse(err)
  }
}

export const PATCH = async (request: NextRequest) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const forbidden = requirePermission(auth, "payments:reconcile")
  if (forbidden) return forbidden

  const parsed = overrideSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError("Invalid reconciliation update.")

  try {
    await overrideReconciliationItem({ input: parsed.data, actorId: auth.sub, request })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return reconciliationErrorResponse(err)
  }
}
