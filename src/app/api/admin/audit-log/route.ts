import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuth, requirePermission, jsonError } from "@/lib/auth/api"

export const GET = async (request: NextRequest) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const forbidden = requirePermission(auth, "users:manage")
  if (forbidden) return forbidden

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number.parseInt(searchParams.get("limit") ?? "50", 10), 200)
  const offset = Math.max(Number.parseInt(searchParams.get("offset") ?? "0", 10), 0)
  const action = searchParams.get("action")

  const admin = createAdminClient()
  let query = admin
    .from("audit_log")
    .select("id, user_id, action, previous_value, updated_value, metadata, ip_address, created_at, users(name, email)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (action) {
    query = query.eq("action", action)
  }

  const { data, error, count } = await query

  if (error) return jsonError(error.message, 500)

  return NextResponse.json({
    logs: data ?? [],
    total: count ?? 0,
    limit,
    offset,
  })
}
