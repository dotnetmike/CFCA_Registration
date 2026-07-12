import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuth, jsonError } from "@/lib/auth/api"
import { writeAuditLog } from "@/lib/audit/log"

type RouteParams = { params: Promise<{ id: string }> }

const noteSchema = z.object({
  body: z.string().trim().min(1, "Note is required").max(5000),
})

const canManageNotes = (permissions: string[]) =>
  permissions.includes("registrations:read_all") &&
  (permissions.includes("registrations:write_all") ||
    permissions.includes("accommodation:write_all") ||
    permissions.includes("payments:reconcile") ||
    permissions.includes("users:manage"))

export const GET = async (request: NextRequest, { params }: RouteParams) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  if (!auth.permissions.includes("registrations:read_all")) return jsonError("Forbidden", 403)

  const { id } = await params
  const admin = createAdminClient()

  const { data: notes, error } = await admin
    .from("registration_admin_notes")
    .select("id, body, created_at, created_by, users(name)")
    .eq("registration_id", id)
    .order("created_at", { ascending: false })

  if (error) return jsonError(error.message, 500)

  const mapped = (notes ?? []).map((n) => {
    const users = n.users as { name?: string } | { name?: string }[] | null
    const name = Array.isArray(users) ? users[0]?.name : users?.name
    return {
      id: n.id,
      body: n.body,
      created_at: n.created_at,
      created_by: n.created_by,
      created_by_name: name ?? "Unknown",
    }
  })

  return NextResponse.json({ notes: mapped })
}

export const POST = async (request: NextRequest, { params }: RouteParams) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  if (!canManageNotes(auth.permissions)) return jsonError("Forbidden", 403)

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = noteSchema.safeParse(body)
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Invalid note")

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from("registrations")
    .select("id")
    .eq("id", id)
    .maybeSingle()

  if (!existing) return jsonError("Not found", 404)

  const { data: note, error } = await admin
    .from("registration_admin_notes")
    .insert({
      registration_id: id,
      body: parsed.data.body,
      created_by: auth.sub,
    })
    .select("id, body, created_at, created_by")
    .single()

  if (error) return jsonError(error.message, 500)

  const { data: author } = await admin
    .from("users")
    .select("name")
    .eq("id", auth.sub)
    .maybeSingle()

  await writeAuditLog({
    userId: auth.sub,
    action: "registration.note_create",
    updatedValue: {
      note_id: note.id,
      body: note.body,
    },
    metadata: { registration_id: id },
    request,
  })

  return NextResponse.json({
    note: {
      ...note,
      created_by_name: author?.name ?? "Unknown",
    },
  })
}
