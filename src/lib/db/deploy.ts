import { loadEnv } from "./load-env"
import { applySetupSql, schemaExists } from "./apply-setup"
import { runMigrations } from "./migrate"
import { seedAdminUser } from "./seed-admin"
import { readMigrationFiles } from "./access-token"
import { runManagementQuery } from "./access-token"

const registerAllMigrations = async () => {
  for (const migration of readMigrationFiles()) {
    const escapedName = migration.name.replace(/'/g, "''")
    await runManagementQuery(
      `INSERT INTO public.schema_migrations (name) VALUES ('${escapedName}') ON CONFLICT (name) DO NOTHING`
    )
  }
}

export const runDatabaseDeploy = async (): Promise<void> => {
  loadEnv()

  if (process.env.SKIP_DB_DEPLOY === "true") {
    console.log("[db] SKIP_DB_DEPLOY=true, skipping")
    return
  }

  console.log("[db] Starting database deploy...")

  const exists = await schemaExists()
  if (!exists) {
    await applySetupSql()
    await registerAllMigrations()
  } else {
    await runMigrations()
  }

  await seedAdminUser()
  console.log("[db] Deploy complete")
}
