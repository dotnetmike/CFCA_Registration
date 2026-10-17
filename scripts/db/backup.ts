/**
 * Full data backup of the selected Supabase project (public schema + storage files).
 *
 *   npm run db:backup                     # → ../CFCA_Registration_Backups/<env>-<ref>-<timestamp>/
 *   npm run db:backup -- --out D:\Backups
 *
 * Output: manifest.json, data/<table>.json, restore.sql (standalone), schema/ snapshot, storage/ files.
 * Contains personal data and password hashes — keep the folder private; never commit it.
 */
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from "fs"
import { dirname, join, resolve } from "path"
import { createServerClient } from "@/lib/supabase/admin"
import {
  DEFAULT_BACKUP_ROOT,
  buildInsertSql,
  fetchAllRows,
  initEnv,
  loadTableMeta,
  parseArgs,
  quoteIdent,
  sha256,
  sql,
  tableRowHash,
  type BackupManifest,
  type BackupTableEntry,
  type SequenceSnapshot,
  type StorageObjectEntry,
} from "./lib/backup-common"

const backupSequences = async (): Promise<SequenceSnapshot[]> => {
  const names = await sql<{ sequencename: string }>(
    `select sequencename from pg_sequences where schemaname = 'public' order by sequencename`
  )
  const snapshots: SequenceSnapshot[] = []
  for (const { sequencename } of names) {
    const [row] = await sql<{ last_value: number; is_called: boolean }>(
      `select last_value::bigint as last_value, is_called from public.${quoteIdent(sequencename)}`
    )
    snapshots.push({ name: sequencename, lastValue: Number(row.last_value), isCalled: row.is_called })
  }
  return snapshots
}

const backupSchemaSnapshot = async (dir: string) => {
  const snapshot = {
    columns: await sql(
      `select table_name, column_name, ordinal_position, data_type, udt_name, is_nullable, column_default from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position`
    ),
    constraints: await sql(
      `select cl.relname as table_name, c.conname, pg_get_constraintdef(c.oid) as definition from pg_constraint c join pg_class cl on cl.oid = c.conrelid where c.connamespace = 'public'::regnamespace order by 1, 2`
    ),
    indexes: await sql(
      `select tablename, indexname, indexdef from pg_indexes where schemaname = 'public' order by 1, 2`
    ),
    enums: await sql(
      `select t.typname, array_agg(e.enumlabel order by e.enumsortorder) as labels from pg_type t join pg_enum e on e.enumtypid = t.oid where t.typnamespace = 'public'::regnamespace group by t.typname order by 1`
    ),
    functions: await sql(
      `select p.proname, pg_get_function_identity_arguments(p.oid) as args, pg_get_functiondef(p.oid) as definition from pg_proc p where p.pronamespace = 'public'::regnamespace order by 1, 2`
    ),
    policies: await sql(
      `select tablename, policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'public' order by 1, 2`
    ),
  }
  mkdirSync(join(dir, "schema", "repo-sql", "migrations"), { recursive: true })
  writeFileSync(join(dir, "schema", "schema-snapshot.json"), JSON.stringify(snapshot, null, 2))

  const repoSql = resolve(process.cwd(), "supabase")
  copyFileSync(join(repoSql, "setup.sql"), join(dir, "schema", "repo-sql", "setup.sql"))
  readdirSync(join(repoSql, "migrations"))
    .filter((f) => f.endsWith(".sql"))
    .forEach((f) =>
      copyFileSync(join(repoSql, "migrations", f), join(dir, "schema", "repo-sql", "migrations", f))
    )
}

const backupStorage = async (dir: string) => {
  const buckets = await sql(`select * from storage.buckets order by id`)
  const objects = await sql<{ bucket_id: string; name: string }>(
    `select bucket_id, name from storage.objects order by bucket_id, name`
  )
  const entries: StorageObjectEntry[] = []
  if (objects.length === 0) return { buckets, objects: entries }

  const client = createServerClient()
  for (const { bucket_id: bucket, name } of objects) {
    const { data, error } = await client.storage.from(bucket).download(name)
    if (error || !data) throw new Error(`Storage download failed for ${bucket}/${name}: ${error?.message}`)
    const buffer = Buffer.from(await data.arrayBuffer())
    const file = join("storage", bucket, name)
    mkdirSync(dirname(join(dir, file)), { recursive: true })
    writeFileSync(join(dir, file), buffer)
    entries.push({ bucket, name, file, size: buffer.length, sha256: sha256(buffer) })
  }
  return { buckets, objects: entries }
}

const buildRestoreSql = (manifest: BackupManifest, tableRows: Map<string, Record<string, unknown>[]>) => {
  const lines = [
    `-- CFCA Registration database restore`,
    `-- Backup taken ${manifest.createdAt} from project ${manifest.projectRef} (APP_ENV=${manifest.appEnv})`,
    `-- Run in the Supabase SQL editor of the SAME project (schema must exist: supabase/setup.sql + migrations).`,
    `-- Re-inserts every backed-up row; rows that still exist (same key / unique value) are left untouched.`,
    `BEGIN;`,
  ]
  manifest.tables.forEach((entry) => {
    const rows = tableRows.get(entry.name) ?? []
    lines.push(`-- ${entry.name}: ${rows.length} rows`)
    if (rows.length > 0) lines.push(buildInsertSql("public", entry, rows))
  })
  manifest.sequences
    .filter((seq) => seq.isCalled)
    .forEach((seq) => {
      const name = `public.${quoteIdent(seq.name)}`
      lines.push(
        `SELECT setval('${name}', GREATEST(${seq.lastValue}, (SELECT last_value FROM ${name})), true);`
      )
    })
  lines.push(`COMMIT;`, ``)
  return lines.join("\n")
}

const main = async () => {
  const args = parseArgs()
  const { appEnv, projectRef } = initEnv()
  const createdAt = new Date().toISOString()
  const root = typeof args.out === "string" ? resolve(args.out) : DEFAULT_BACKUP_ROOT
  const dir = join(root, `${appEnv}-${projectRef}-${createdAt.replace(/[:.]/g, "-")}`)
  mkdirSync(join(dir, "data"), { recursive: true })

  console.log(`[backup] APP_ENV=${appEnv} project=${projectRef}`)
  console.log(`[backup] Writing to ${dir}`)

  const metas = await loadTableMeta()
  const tables: BackupTableEntry[] = []
  const tableRows = new Map<string, Record<string, unknown>[]>()

  for (const meta of metas) {
    const rows = await fetchAllRows(meta)
    const live = await tableRowHash("public", meta.name)
    if (live.rowCount !== rows.length) {
      throw new Error(
        `${meta.name}: fetched ${rows.length} rows but table has ${live.rowCount} (data changed during backup?) — re-run`
      )
    }
    const file = join("data", `${meta.name}.json`)
    const content = JSON.stringify(rows, null, 1)
    writeFileSync(join(dir, file), content)
    tableRows.set(meta.name, rows)
    tables.push({
      name: meta.name,
      file,
      rowCount: rows.length,
      fileSha256: sha256(content),
      rowHash: live.rowHash,
      primaryKey: meta.primaryKey,
      insertColumns: meta.insertColumns,
      identityAlways: meta.identityAlways,
    })
    console.log(`[backup]   ${meta.name.padEnd(32)} ${String(rows.length).padStart(6)} rows`)
  }

  const sequences = await backupSequences()
  sequences.forEach((s) => console.log(`[backup]   sequence ${s.name} = ${s.lastValue}`))

  await backupSchemaSnapshot(dir)
  const storage = await backupStorage(dir)
  console.log(
    `[backup]   storage: ${storage.buckets.length} bucket(s), ${storage.objects.length} object(s)`
  )

  const manifest: BackupManifest = {
    formatVersion: 1,
    createdAt,
    appEnv,
    projectRef,
    restoreOrder: metas.map((m) => m.name),
    tables,
    sequences,
    storage,
  }
  writeFileSync(join(dir, "restore.sql"), buildRestoreSql(manifest, tableRows))
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2))

  console.log(`[backup] Done. Next: npm run db:backup:verify -- --backup "${dir}"`)
}

main().catch((err) => {
  console.error("[backup] FAILED:", err instanceof Error ? err.message : err)
  process.exit(1)
})
