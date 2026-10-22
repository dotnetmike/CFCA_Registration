import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requirePermission, jsonError } from "@/lib/auth/api"
import { BACKUPS_PERMISSION } from "@/lib/backups/types"
import { listRegistrationBackups } from "@/lib/backups/service"

export const runtime = "nodejs"

export const GET = async (request: NextRequest) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const forbidden = requirePermission(auth, BACKUPS_PERMISSION)
  if (forbidden) return forbidden

  try {
    return NextResponse.json({ backups: await listRegistrationBackups() })
  } catch (err) {
    console.error("[backups] list failed", err)
    return jsonError("Could not load backups.", 500)
  }
}
