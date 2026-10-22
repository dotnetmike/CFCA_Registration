export const BACKUPS_PERMISSION = "backups:manage"

export type RegistrationBackupStatus = "processing" | "completed"

export type RegistrationBackupView = {
  id: string
  backupDate: string
  status: RegistrationBackupStatus
  fileName: string
  sizeBytes: number
  registrationCount: number
  createdAt: string
  completedAt: string | null
  createdByName: string | null
}

export type EnsureDailyBackupResult = {
  backup: RegistrationBackupView
  created: boolean
}

export const BACKUP_HELP = {
  page:
    "A backup of every registration is created automatically the first time an admin opens the Registrations Dashboard each day (Melbourne time). Each backup is one zipped CSV with the same columns as the detailed CSV export, stored privately on the server. Only admins can see and download backups.",
  download:
    "Downloads the zipped CSV. It contains participants' personal details: store it securely and delete local copies when no longer needed.",
} as const

export const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
