import { readdirSync } from "fs"
import { join } from "path"
import { loadEnv } from "@/lib/db/load-env"
import { managementSelect } from "@/lib/db/management-query"
import { runManagementQuery } from "@/lib/db/access-token"

type MigrationRow = { version: string; name: string | null }

const parseMigrationFile = (filename: string) => {
  const base = filename.replace(/\.sql$/, "")
  const match = base.match(/^(\d+)_(.+)$/)
  if (!match) {
    throw new Error(`Unexpected migration filename: ${filename}`)
  }
  return { version: match[1], name: match[2], filename: base }
}

const readLocalMigrations = () => {
  const dir = join(process.cwd(), "supabase", "migrations")
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map(parseMigrationFile)
}

const repairSupabaseMigrationHistory = async () => {
  loadEnv()

  console.log("[repair] Syncing supabase_migrations.schema_migrations with applied schema...")

  const remote = await managementSelect<MigrationRow>(
    "SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version"
  )
  const customApplied = await managementSelect<{ name: string }>(
    "SELECT name FROM public.schema_migrations ORDER BY name"
  ).catch(() => [] as { name: string }[])

  const remoteVersions = new Set(remote.map((row) => row.version))
  const customFilenames = new Set(customApplied.map((row) => row.name.replace(/\.sql$/, "")))

  const localMigrations = readLocalMigrations()
  const shouldBeApplied = (migration: ReturnType<typeof parseMigrationFile>) => {
    if (remoteVersions.has(migration.version)) return false
    if (customFilenames.has(migration.filename)) return true
    // Custom runner skipped 000 but Supabase Git tracks it separately
    if (migration.version === "000") return remoteVersions.size > 0
    return false
  }

  const pending = localMigrations.filter(shouldBeApplied)

  console.log(`[repair] Remote supabase_migrations: ${remote.length} row(s)`)
  console.log(`[repair] Remote public.schema_migrations: ${customApplied.length} row(s)`)
  console.log(`[repair] Pending repair inserts: ${pending.length}`)

  if (pending.length === 0) {
    console.log("[repair] Already in sync — nothing to do")
    return
  }

  for (const migration of pending) {
    const escapedVersion = migration.version.replace(/'/g, "''")
    const escapedName = migration.name.replace(/'/g, "''")
    console.log(`[repair] Marking applied: ${migration.version} (${migration.name})`)
    await runManagementQuery(`
      INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
      VALUES ('${escapedVersion}', '${escapedName}', ARRAY[]::text[])
      ON CONFLICT (version) DO NOTHING;
    `)
  }

  const after = await managementSelect<MigrationRow>(
    "SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version"
  )
  console.log(`[repair] Done. supabase_migrations now has ${after.length} row(s):`)
  for (const row of after) {
    console.log(`  - ${row.version} ${row.name ?? ""}`.trim())
  }
}

repairSupabaseMigrationHistory().catch((err) => {
  console.error("[repair] Failed:", err)
  process.exit(1)
})
