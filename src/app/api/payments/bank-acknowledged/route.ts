import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, jsonError } from "@/lib/auth/api"
import { writeAuditLog } from "@/lib/audit/log"
import {
  getRegistrationBySignupToken,
  getRegistrationByViewToken,
} from "@/lib/registrations/view-token"
import { createAdminClient } from "@/lib/supabase/admin"

const bodySchema = z.object({
  signupToken: z.string().min(1).optional(),
  viewToken: z.string().min(1).optional(),
  registrationId: z.string().uuid().optional(),
})

export const POST = async (request: NextRequest) => {
  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return jsonError("Invalid request")

  let registrationId: string | null = null

  if (parsed.data.signupToken) {
    const reg = await getRegistrationBySignupToken(parsed.data.signupToken)
    registrationId = reg?.id ?? null
  } else if (parsed.data.viewToken) {
    const reg = await getRegistrationByViewToken(parsed.data.viewToken)
    registrationId = reg?.id ?? null
  } else if (parsed.data.registrationId) {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const admin = createAdminClient()
    const { data } = await admin
      .from("registrations")
      .select("id, user_id")
      .eq("id", parsed.data.registrationId)
      .maybeSingle()
    if (data && (data.user_id === auth.sub || auth.permissions.includes("registrations:write_all"))) {
      registrationId = data.id
    }
  }

  if (!registrationId) return jsonError("Registration not found", 404)

  await writeAuditLog({
    action: "payment.bank_option_selected",
    metadata: { registration_id: registrationId },
    request,
  })

  return NextResponse.json({ ok: true })
}
