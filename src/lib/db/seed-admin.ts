import bcrypt from "bcryptjs"
import { normalizeEmail } from "@/lib/utils"
import { createServerClient } from "@/lib/supabase/admin"
import { managementExecute, managementSelect } from "./management-query"

export const seedAdminUser = async (): Promise<void> => {
  const email = process.env.SEED_ADMIN_EMAIL
  const name = process.env.SEED_ADMIN_NAME ?? "Admin"
  const password = process.env.SEED_ADMIN_PASSWORD

  if (!email || !password) {
    console.log("[db] Skipping admin seed (SEED_ADMIN_EMAIL/PASSWORD not set)")
    return
  }

  const normalizedEmail = normalizeEmail(email)
  const passwordHash = await bcrypt.hash(password, 12)

  let existing: { id: string }[] = []
  try {
    const admin = createServerClient()
    const { data } = await admin
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle()
    if (data) existing = [data]
  } catch {
    existing = await managementSelect<{ id: string }>(
      `SELECT id FROM public.users WHERE email = '${normalizedEmail.replace(/'/g, "''")}' LIMIT 1`
    )
  }

  if (existing.length > 0) {
    const id = existing[0].id
    try {
      const admin = createServerClient()
      await admin
        .from("users")
        .update({ password_hash: passwordHash, name, is_active: true })
        .eq("id", id)
    } catch {
      await managementExecute(
        `UPDATE public.users SET password_hash = '${passwordHash}', name = '${name.replace(/'/g, "''")}', is_active = true WHERE id = '${id}'`
      )
    }
    console.log("[db] Admin user password updated")
    return
  }

  try {
    const admin = createServerClient()
    const { data: user, error: userError } = await admin
      .from("users")
      .insert({
        email: normalizedEmail,
        password_hash: passwordHash,
        name,
        is_active: true,
      })
      .select("id")
      .single()

    if (userError) throw userError

    const { data: adminGroup } = await admin
      .from("user_groups")
      .select("id")
      .eq("name", "admin")
      .single()

    if (adminGroup) {
      await admin.from("user_user_groups").insert({
        user_id: user.id,
        group_id: adminGroup.id,
      })
    }
  } catch {
    await managementExecute(
      `INSERT INTO public.users (email, password_hash, name, is_active) VALUES ('${normalizedEmail}', '${passwordHash}', '${name.replace(/'/g, "''")}', true)`
    )
    const rows = await managementSelect<{ id: string }>(
      `SELECT id FROM public.users WHERE email = '${normalizedEmail}' LIMIT 1`
    )
    const userId = rows[0]?.id
    if (userId) {
      await managementExecute(
        `INSERT INTO public.user_user_groups (user_id, group_id) SELECT '${userId}', id FROM public.user_groups WHERE name = 'admin' ON CONFLICT DO NOTHING`
      )
    }
  }

  console.log("[db] Admin user seeded")
}
