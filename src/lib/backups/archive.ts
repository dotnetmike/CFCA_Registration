import { strToU8, zipSync } from "fflate"
import { buildDetailedRegistrationsCsv } from "@/lib/dashboard/reports-csv"

export const REGISTRATION_BACKUP_BUCKET = "registration-backups"

export const getBackupFileNames = (backupDate: string) => ({
  zipFileName: `registrations-backup-${backupDate}.zip`,
  csvFileName: `registrations-${backupDate}.csv`,
})

/** Storage object path, grouped by year: `2026/registrations-backup-2026-10-22.zip`. */
export const getBackupStoragePath = (backupDate: string) =>
  `${backupDate.slice(0, 4)}/${getBackupFileNames(backupDate).zipFileName}`

export const buildRegistrationBackupArchive = (
  registrations: Record<string, unknown>[],
  backupDate: string,
  createdAt = new Date()
) => {
  const { zipFileName, csvFileName } = getBackupFileNames(backupDate)
  const csv = buildDetailedRegistrationsCsv(registrations)
  const bytes = zipSync({ [csvFileName]: [strToU8(csv), { mtime: createdAt }] }, { level: 9 })
  return { zipFileName, csvFileName, bytes, registrationCount: registrations.length }
}
