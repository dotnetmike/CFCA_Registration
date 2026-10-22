import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, requirePermission, jsonError } from "@/lib/auth/api"
import { BACKUPS_PERMISSION } from "@/lib/backups/types"
import { RegistrationBackupNotFoundError, downloadRegistrationBackup } from "@/lib/backups/service"

export const runtime = "nodejs"

type RouteParams = { params: Promise<{ id: string }> }

export const GET = async (request: NextRequest, { params }: RouteParams) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const forbidden = requirePermission(auth, BACKUPS_PERMISSION)
  if (forbidden) return forbidden

  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return jsonError("Backup not found.", 404)

  try {
    const { fileName, bytes } = await downloadRegistrationBackup({ id, actorId: auth.sub, request })
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    if (err instanceof RegistrationBackupNotFoundError) return jsonError(err.message, 404)
    console.error("[backups] download failed", err)
    return jsonError("Could not download the backup.", 500)
  }
}
