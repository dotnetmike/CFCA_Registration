import { readMigrationFiles, runManagementQuery } from "./access-token"
import { managementSelect } from "./management-query"

export const runMigrations = async (): Promise<void> => {
  let applied: { name: string }[] = []
  try {
    applied = await managementSelect<{ name: string }>(
      "SELECT name FROM public.schema_migrations"
    )
  } catch {
    console.log("[db] schema_migrations not ready, skipping incremental migrations")
    return
  }

  const appliedNames = new Set(applied.map((r) => r.name))
  const pending = readMigrationFiles().filter((m) => !appliedNames.has(m.name))

  if (pending.length === 0) {
    console.log("[db] No pending migrations")
    return
  }

  for (const migration of pending) {
    console.log(`[db] Applying migration: ${migration.name}`)
    await runManagementQuery(migration.sql)
    const escapedName = migration.name.replace(/'/g, "''")
    await runManagementQuery(
      `INSERT INTO public.schema_migrations (name) VALUES ('${escapedName}') ON CONFLICT (name) DO NOTHING`
    )
  }

  console.log(`[db] Applied ${pending.length} migration(s)`)
}
