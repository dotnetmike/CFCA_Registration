import {
  buildInsertSql,
  chunk,
  readTableRows,
  sql,
  type BackupManifest,
} from "./backup-common"

const ROWS_PER_REQUEST = 200

/** Inserts every backed-up row into `schema` (parents first). Existing rows are left untouched. */
export const restoreTables = async (
  backupDir: string,
  manifest: BackupManifest,
  schema: string,
  log: (line: string) => void = console.log
) => {
  const byName = new Map(manifest.tables.map((t) => [t.name, t]))
  const results: { table: string; inBackup: number; inserted: number }[] = []

  for (const name of manifest.restoreOrder) {
    const entry = byName.get(name)
    if (!entry) throw new Error(`Manifest restoreOrder lists unknown table ${name}`)
    const rows = readTableRows(backupDir, entry)
    let inserted = 0
    for (const batch of chunk(rows, ROWS_PER_REQUEST)) {
      const [result] = await sql<{ n: number }>(
        buildInsertSql(schema, entry, batch, { returnCount: true })
      )
      inserted += Number(result?.n ?? 0)
    }
    results.push({ table: name, inBackup: rows.length, inserted })
    log(`  ${name.padEnd(32)} ${String(rows.length).padStart(6)} in backup, ${String(inserted).padStart(6)} inserted`)
  }

  return results
}
