import { createHash } from "crypto"
import type { NextRequest } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { writeAuditLog } from "@/lib/audit/log"
import { melbourneDate } from "@/lib/reconciliation/matching"
import {
  REGISTRATION_BACKUP_BUCKET,
  buildRegistrationBackupArchive,
  getBackupStoragePath,
} from "@/lib/backups/archive"
import type {
  EnsureDailyBackupResult,
  RegistrationBackupStatus,
  RegistrationBackupView,
} from "@/lib/backups/types"

const TABLE = "registration_backups"
const REGISTRATION_PAGE_SIZE = 1000
/** A claim older than this is treated as abandoned (e.g. the server stopped mid-backup). */
const STALE_CLAIM_MS = 10 * 60 * 1000
const BACKUP_COLUMNS =
  "id, backup_date, status, file_path, file_name, size_bytes, registration_count, file_sha256, created_by, created_at, completed_at"

type BackupRow = {
  id: string
  backup_date: string
  status: RegistrationBackupStatus
  file_path: string
  file_name: string
  size_bytes: number | string
  registration_count: number
  file_sha256: string
  created_by: string | null
  created_at: string
  completed_at: string | null
}

export class RegistrationBackupNotFoundError extends Error {}

const loadUserNames = async (admin: SupabaseClient, ids: (string | null)[]) => {
  const uniqueIds = [...new Set(ids.filter((id): id is string => !!id))]
  if (uniqueIds.length === 0) return new Map<string, string>()
  const { data, error } = await admin.from("users").select("id, name, email").in("id", uniqueIds)
  if (error) throw new Error(error.message)
  return new Map((data ?? []).map((u) => [u.id as string, (u.name as string) || (u.email as string)]))
}

const toViews = async (admin: SupabaseClient, rows: BackupRow[]): Promise<RegistrationBackupView[]> => {
  const names = await loadUserNames(admin, rows.map((r) => r.created_by))
  return rows.map((r) => ({
    id: r.id,
    backupDate: r.backup_date,
    status: r.status,
    fileName: r.file_name,
    sizeBytes: Number(r.size_bytes),
    registrationCount: r.registration_count,
    createdAt: r.created_at,
    completedAt: r.completed_at,
    createdByName: r.created_by ? names.get(r.created_by) ?? null : null,
  }))
}

const toView = async (admin: SupabaseClient, row: BackupRow) => (await toViews(admin, [row]))[0]

const findBackupByDate = async (admin: SupabaseClient, backupDate: string) => {
  const { data, error } = await admin.from(TABLE).select(BACKUP_COLUMNS).eq("backup_date", backupDate).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as BackupRow | null) ?? null
}

const isStaleClaim = (row: BackupRow, now: Date) =>
  row.status === "processing" && now.getTime() - Date.parse(row.created_at) > STALE_CLAIM_MS

/** Every registration (drafts included) with its attendees, paged past the API row limit. */
const loadAllRegistrations = async (admin: SupabaseClient) => {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += REGISTRATION_PAGE_SIZE) {
    const { data, error } = await admin
      .from("registrations")
      .select("*, registration_attendees(*)")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .order("sort_order", { referencedTable: "registration_attendees", ascending: true })
      .range(from, from + REGISTRATION_PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as Record<string, unknown>[]))
    if (!data || data.length < REGISTRATION_PAGE_SIZE) return rows
  }
}

const claimBackupDate = async (admin: SupabaseClient, backupDate: string, actorId: string) => {
  const { data, error } = await admin
    .from(TABLE)
    .insert({ backup_date: backupDate, status: "processing", created_by: actorId })
    .select(BACKUP_COLUMNS)
    .single()
  if (!error) return { claim: data as BackupRow }
  if (error.code === "23505") return { claim: null }
  throw new Error(error.message)
}

/**
 * Creates today's backup (Melbourne date) unless one already exists.
 * The unique backup_date row is claimed first, so concurrent dashboard visits create one backup only.
 */
export const ensureDailyRegistrationBackup = async ({
  actorId,
  request,
  now = new Date(),
}: {
  actorId: string
  request?: NextRequest
  now?: Date
}): Promise<EnsureDailyBackupResult> => {
  const admin = createAdminClient()
  const backupDate = melbourneDate(now.toISOString())

  const existing = await findBackupByDate(admin, backupDate)
  if (existing && !isStaleClaim(existing, now)) return { created: false, backup: await toView(admin, existing) }
  if (existing) {
    await admin.from(TABLE).delete().eq("id", existing.id).eq("status", "processing")
  }

  const { claim } = await claimBackupDate(admin, backupDate, actorId)
  if (!claim) {
    const current = await findBackupByDate(admin, backupDate)
    if (!current) throw new Error("Could not claim today's backup. Please try again.")
    return { created: false, backup: await toView(admin, current) }
  }

  try {
    const registrations = await loadAllRegistrations(admin)
    const archive = buildRegistrationBackupArchive(registrations, backupDate, now)
    const filePath = getBackupStoragePath(backupDate)
    const { error: uploadError } = await admin.storage
      .from(REGISTRATION_BACKUP_BUCKET)
      .upload(filePath, archive.bytes, { contentType: "application/zip", upsert: true })
    if (uploadError) throw new Error(`Backup upload failed: ${uploadError.message}`)

    const { data: completed, error: updateError } = await admin
      .from(TABLE)
      .update({
        status: "completed",
        file_path: filePath,
        file_name: archive.zipFileName,
        size_bytes: archive.bytes.byteLength,
        registration_count: archive.registrationCount,
        file_sha256: createHash("sha256").update(archive.bytes).digest("hex"),
        completed_at: new Date().toISOString(),
      })
      .eq("id", claim.id)
      .select(BACKUP_COLUMNS)
      .single()
    if (updateError) throw new Error(updateError.message)

    await writeAuditLog({
      userId: actorId,
      action: "registration.backup_create",
      updatedValue: {
        backup_date: backupDate,
        file_name: archive.zipFileName,
        registration_count: archive.registrationCount,
        size_bytes: archive.bytes.byteLength,
      },
      metadata: { backup_id: claim.id, trigger: "dashboard_visit" },
      request,
    })
    return { created: true, backup: await toView(admin, completed as BackupRow) }
  } catch (err) {
    await admin.from(TABLE).delete().eq("id", claim.id)
    await writeAuditLog({
      userId: actorId,
      action: "registration.backup_failed",
      metadata: { backup_date: backupDate, error: err instanceof Error ? err.message : String(err) },
      request,
    })
    throw err
  }
}

export const listRegistrationBackups = async (): Promise<RegistrationBackupView[]> => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from(TABLE)
    .select(BACKUP_COLUMNS)
    .order("backup_date", { ascending: false })
  if (error) throw new Error(error.message)
  return toViews(admin, (data ?? []) as BackupRow[])
}

export const downloadRegistrationBackup = async ({
  id,
  actorId,
  request,
}: {
  id: string
  actorId: string
  request?: NextRequest
}) => {
  const admin = createAdminClient()
  const { data, error } = await admin.from(TABLE).select(BACKUP_COLUMNS).eq("id", id).maybeSingle()
  if (error) throw new Error(error.message)
  const row = data as BackupRow | null
  if (!row || row.status !== "completed") throw new RegistrationBackupNotFoundError("Backup not found.")

  const { data: file, error: downloadError } = await admin.storage
    .from(REGISTRATION_BACKUP_BUCKET)
    .download(row.file_path)
  if (downloadError || !file) {
    throw new RegistrationBackupNotFoundError(
      `The backup file is missing from storage${downloadError ? `: ${downloadError.message}` : "."}`
    )
  }
  const bytes = Buffer.from(await file.arrayBuffer())

  await writeAuditLog({
    userId: actorId,
    action: "registration.backup_download",
    metadata: { backup_id: row.id, backup_date: row.backup_date, file_name: row.file_name },
    request,
  })
  return { fileName: row.file_name, bytes }
}
