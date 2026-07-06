import { readFileSync, readdirSync } from "fs"
import { join } from "path"
import { getProjectRef } from "@/lib/supabase/env"

export const getAccessToken = (): string | null => {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) return null
  if (token.startsWith("sb_secret_") || token.startsWith("sb_publishable_")) {
    throw new Error(
      "SUPABASE_ACCESS_TOKEN must be a Personal Access Token (sbp_…), not a service role or publishable key."
    )
  }
  return token
}

export const runManagementQuery = async (sql: string): Promise<void> => {
  const token = getAccessToken()
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN is not set")

  const ref = getProjectRef()
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Management API error (${res.status}): ${body}`)
  }
}

export const readSetupSql = (): string => {
  const setupPath = join(process.cwd(), "supabase", "setup.sql")
  return readFileSync(setupPath, "utf-8")
}

export const readMigrationFiles = (): { name: string; sql: string }[] => {
  const dir = join(process.cwd(), "supabase", "migrations")
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql") && f !== "000_migration_runner.sql")
    .sort()

  return files.map((name) => ({
    name,
    sql: readFileSync(join(dir, name), "utf-8"),
  }))
}
