import { loadEnv } from "@/lib/db/load-env"
import { managementSelect } from "@/lib/db/management-query"

loadEnv()

const main = async () => {
  try {
    const columns = await managementSelect<{
      table_schema: string
      table_name: string
      column_name: string
      data_type: string
    }>(`
      SELECT table_schema, table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'supabase_migrations'
      ORDER BY table_name, ordinal_position
    `)
    console.log("supabase_migrations columns:", JSON.stringify(columns, null, 2))
  } catch (err) {
    console.log("columns error:", err)
  }

  try {
    const rows = await managementSelect<{ version: string; name: string | null }>(
      "SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version"
    )
    console.log("supabase_migrations rows:", JSON.stringify(rows, null, 2))
  } catch (err) {
    console.log("supabase_migrations rows error:", err)
  }

  try {
    const rows = await managementSelect<{ name: string }>(
      "SELECT name FROM public.schema_migrations ORDER BY name"
    )
    console.log("public.schema_migrations rows:", JSON.stringify(rows, null, 2))
  } catch (err) {
    console.log("public.schema_migrations error:", err)
  }
}

main().catch(console.error)
