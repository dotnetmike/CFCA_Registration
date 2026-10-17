import { createHash } from "crypto"
import { existsSync, readFileSync } from "fs"
import { join, resolve } from "path"
import { loadEnv } from "@/lib/db/load-env"
import { managementSelect } from "@/lib/db/management-query"
import { getProjectRef } from "@/lib/supabase/env"

export type TableMeta = {
  name: string
  primaryKey: string[]
  columns: string[]
  insertColumns: string[]
  identityAlways: boolean
  dependsOn: string[]
}

export type SequenceSnapshot = { name: string; lastValue: number; isCalled: boolean }

export type BackupTableEntry = {
  name: string
  file: string
  rowCount: number
  fileSha256: string
  rowHash: string
  primaryKey: string[]
  insertColumns: string[]
  identityAlways: boolean
}

export type StorageObjectEntry = { bucket: string; name: string; file: string; size: number; sha256: string }

export type BackupManifest = {
  formatVersion: 1
  createdAt: string
  appEnv: string
  projectRef: string
  restoreOrder: string[]
  tables: BackupTableEntry[]
  sequences: SequenceSnapshot[]
  storage: { buckets: Record<string, unknown>[]; objects: StorageObjectEntry[] }
}

export type VerificationReport = {
  ok: boolean
  verifiedAt: string
  backupCreatedAt: string
  projectRef: string
  checks: { name: string; ok: boolean; detail: string }[]
}

export const DEFAULT_BACKUP_ROOT = resolve(process.cwd(), "..", "CFCA_Registration_Backups")

export const initEnv = () => {
  loadEnv()
  return { appEnv: process.env.APP_ENV ?? "unknown", projectRef: getProjectRef() }
}

export const sql = <T extends Record<string, unknown> = Record<string, unknown>>(query: string) =>
  managementSelect<T>(query)

export const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`

export const sha256 = (content: string | Buffer) => createHash("sha256").update(content).digest("hex")

export const parseArgs = (): Record<string, string | true> => {
  const args = process.argv.slice(2)
  const parsed: Record<string, string | true> = {}
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (!arg.startsWith("--")) continue
    const body = arg.slice(2)
    const equalsAt = body.indexOf("=")
    if (equalsAt > 0) {
      parsed[body.slice(0, equalsAt)] = body.slice(equalsAt + 1)
      continue
    }
    const next = args[i + 1]
    if (next !== undefined && !next.startsWith("--")) {
      parsed[body] = next
      i++
      continue
    }
    parsed[body] = true
  }
  return parsed
}

/** Public tables with columns, primary keys, and FK dependencies, sorted parents-first. */
export const loadTableMeta = async (): Promise<TableMeta[]> => {
  const tables = await sql<{ table_name: string }>(
    `select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`
  )
  const columns = await sql<{
    table_name: string
    column_name: string
    is_generated: string
    identity_generation: string | null
  }>(
    `select table_name, column_name, is_generated, identity_generation from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position`
  )
  const primaryKeys = await sql<{ table_name: string; column_name: string }>(
    `select cl.relname as table_name, a.attname as column_name
       from pg_constraint c
       join pg_class cl on cl.oid = c.conrelid
       join lateral unnest(c.conkey) with ordinality as k(attnum, ord) on true
       join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
      where c.contype = 'p' and c.connamespace = 'public'::regnamespace
      order by cl.relname, k.ord`
  )
  const foreignKeys = await sql<{ tbl: string; ref: string }>(
    `select child.relname as tbl, parent.relname as ref
       from pg_constraint c
       join pg_class child on child.oid = c.conrelid
       join pg_class parent on parent.oid = c.confrelid
      where c.contype = 'f' and c.connamespace = 'public'::regnamespace`
  )

  const metas: TableMeta[] = tables.map(({ table_name: name }) => {
    const tableColumns = columns.filter((c) => c.table_name === name)
    return {
      name,
      primaryKey: primaryKeys.filter((p) => p.table_name === name).map((p) => p.column_name),
      columns: tableColumns.map((c) => c.column_name),
      insertColumns: tableColumns.filter((c) => c.is_generated !== "ALWAYS").map((c) => c.column_name),
      identityAlways: tableColumns.some((c) => c.identity_generation === "ALWAYS"),
      dependsOn: [
        ...new Set(foreignKeys.filter((f) => f.tbl === name && f.ref !== name).map((f) => f.ref)),
      ],
    }
  })

  return sortParentsFirst(metas)
}

const sortParentsFirst = (metas: TableMeta[]) => {
  const byName = new Map(metas.map((m) => [m.name, m]))
  const sorted: TableMeta[] = []
  const visiting = new Set<string>()
  const done = new Set<string>()

  const visit = (meta: TableMeta) => {
    if (done.has(meta.name)) return
    if (visiting.has(meta.name)) throw new Error(`Circular foreign key involving ${meta.name}`)
    visiting.add(meta.name)
    meta.dependsOn.forEach((dep) => {
      const parent = byName.get(dep)
      if (parent) visit(parent)
    })
    visiting.delete(meta.name)
    done.add(meta.name)
    sorted.push(meta)
  }

  metas.forEach(visit)
  return sorted
}

const orderByClause = (meta: Pick<TableMeta, "primaryKey">) =>
  meta.primaryKey.length > 0 ? meta.primaryKey.map(quoteIdent).join(", ") : "t::text"

export const fetchAllRows = async (meta: TableMeta, pageSize = 1000) => {
  const rows: Record<string, unknown>[] = []
  for (let offset = 0; ; offset += pageSize) {
    const [result] = await sql<{ rows: Record<string, unknown>[] }>(
      `select coalesce(json_agg(t), '[]'::json) as rows from (select * from public.${quoteIdent(meta.name)} t order by ${orderByClause(meta)} limit ${pageSize} offset ${offset}) t`
    )
    const page = result?.rows ?? []
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}

/** Row count + md5 over every row's text form; identical data gives an identical hash. */
export const tableRowHash = async (schema: string, table: string) => {
  const [result] = await sql<{ n: number; h: string }>(
    `select count(*)::int as n, md5(coalesce(string_agg(t::text, E'\\n' order by t::text), '')) as h from ${quoteIdent(schema)}.${quoteIdent(table)} t`
  )
  return { rowCount: result.n, rowHash: result.h }
}

export const rowKey = (row: Record<string, unknown>, primaryKey: string[]) =>
  primaryKey.length > 0
    ? primaryKey.map((col) => String(row[col])).join("|")
    : JSON.stringify(row)

const dollarTag = (payload: string) => {
  let tag = "cfca_backup"
  while (payload.includes(`$${tag}$`)) tag = `${tag}_x`
  return `$${tag}$`
}

/** INSERT ... SELECT FROM jsonb_populate_recordset; existing rows (any unique conflict) are left untouched. */
export const buildInsertSql = (
  schema: string,
  entry: Pick<BackupTableEntry, "name" | "insertColumns" | "identityAlways">,
  rows: Record<string, unknown>[],
  { returnCount = false } = {}
) => {
  const payload = JSON.stringify(rows)
  const tag = dollarTag(payload)
  const target = `${quoteIdent(schema)}.${quoteIdent(entry.name)}`
  const columnList = entry.insertColumns.map(quoteIdent).join(", ")
  const overriding = entry.identityAlways ? " OVERRIDING SYSTEM VALUE" : ""
  const insert = `INSERT INTO ${target} (${columnList})${overriding} SELECT ${columnList} FROM jsonb_populate_recordset(NULL::${target}, ${tag}${payload}${tag}::jsonb) ON CONFLICT DO NOTHING`
  return returnCount
    ? `WITH inserted AS (${insert} RETURNING 1) SELECT count(*)::int AS n FROM inserted`
    : `${insert};`
}

export const chunk = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size))

export const readManifest = (backupDir: string): BackupManifest => {
  const path = join(backupDir, "manifest.json")
  if (!existsSync(path)) throw new Error(`No manifest.json in ${backupDir}`)
  return JSON.parse(readFileSync(path, "utf-8")) as BackupManifest
}

export const readTableRows = (backupDir: string, entry: BackupTableEntry) =>
  JSON.parse(readFileSync(join(backupDir, entry.file), "utf-8")) as Record<string, unknown>[]

export const requireBackupDir = (args: Record<string, string | true>) => {
  if (typeof args.backup !== "string") throw new Error("Pass --backup <path to backup folder>")
  const dir = resolve(args.backup)
  if (!existsSync(dir)) throw new Error(`Backup folder not found: ${dir}`)
  return dir
}

export const requireProjectConfirmation = (
  args: Record<string, string | true>,
  projectRef: string,
  action: string
) => {
  if (args["confirm-project"] !== projectRef) {
    throw new Error(
      `Refusing to ${action}: pass --confirm-project ${projectRef} to confirm the target Supabase project.`
    )
  }
}
