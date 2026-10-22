import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requirePermission, jsonError } from "@/lib/auth/api"
import { BACKUPS_PERMISSION } from "@/lib/backups/types"
import { ensureDailyRegistrationBackup } from "@/lib/backups/service"

export const runtime = "nodejs"

export const POST = async (request: NextRequest) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const forbidden = requirePermission(auth, BACKUPS_PERMISSION)
  if (forbidden) return forbidden

  try {
    return NextResponse.json(await ensureDailyRegistrationBackup({ actorId: auth.sub, request }))
  } catch (err) {
    console.error("[backups] daily backup failed", err)
    return jsonError(
      err instanceof Error ? `Today's backup could not be created: ${err.message}` : "Today's backup could not be created.",
      500
    )
  }
}
