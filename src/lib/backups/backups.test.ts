import assert from "node:assert/strict"
import test from "node:test"
import { strFromU8, unzipSync } from "fflate"

import { buildRegistrationBackupArchive, getBackupFileNames, getBackupStoragePath } from "./archive"
import { formatFileSize } from "./types"

const REGISTRATIONS: Record<string, unknown>[] = [
  {
    id: "reg-1",
    registration_no: "CFCA27-0001",
    surname: "Sample",
    given_name: "Alex",
    email: "alex@example.com",
    amount_due: 440,
    amount_paid: 200,
    payment_status: "partial",
    participant_reference: "VIC_SAMPLE_001",
    view_token_hash: "secret-view",
    signup_token_hash: "secret-signup",
    souvenir_orders: [{ size: "M", quantity: 2 }],
    registration_attendees: [{ given_name: "Kid", surname: "Sample", age: 8, needs_kids_supervision: true }],
  },
  {
    id: "reg-2",
    registration_no: "CFCA27-0002",
    surname: "Example, Jr",
    given_name: "Sam",
    email: "sam@example.com",
    amount_due: 220,
    amount_paid: 220,
    payment_status: "paid",
    participant_reference: "NSW_EXAMPLE_001",
    registration_attendees: [],
  },
]

const unzipCsv = (bytes: Uint8Array, csvFileName: string) => {
  const files = unzipSync(bytes)
  assert.deepEqual(Object.keys(files), [csvFileName])
  return strFromU8(files[csvFileName])
}

test("backup file names and storage path are derived from the Melbourne backup date", () => {
  assert.deepEqual(getBackupFileNames("2026-10-22"), {
    zipFileName: "registrations-backup-2026-10-22.zip",
    csvFileName: "registrations-2026-10-22.csv",
  })
  assert.equal(getBackupStoragePath("2026-10-22"), "2026/registrations-backup-2026-10-22.zip")
})

test("backup archive is a zip holding one CSV with every registration and no secrets", () => {
  const archive = buildRegistrationBackupArchive(REGISTRATIONS, "2026-10-22", new Date("2026-10-22T01:00:00Z"))
  assert.equal(archive.zipFileName, "registrations-backup-2026-10-22.zip")
  assert.equal(archive.registrationCount, 2)

  const csv = unzipCsv(archive.bytes, archive.csvFileName)
  const [header, ...rows] = csv.split("\n")
  assert.equal(rows.length, 2)
  assert.ok(header.startsWith("surname,given_name,email"))
  assert.ok(header.includes("balance_due"))
  assert.ok(!csv.includes("view_token_hash") && !csv.includes("secret-view"))
  assert.ok(!csv.includes("signup_token_hash") && !csv.includes("secret-signup"))
  assert.ok(rows[0].includes("CFCA27-0001") && rows[0].includes("240.00"))
  assert.ok(rows[0].includes("2 x Medium (M)") && rows[0].includes("Kid Sample (age 8) (kids supervision)"))
  assert.ok(rows[1].includes('"Example, Jr"'))
})

test("backup archive with no registrations still produces a readable zip", () => {
  const archive = buildRegistrationBackupArchive([], "2026-10-23")
  assert.equal(archive.registrationCount, 0)
  const csv = unzipCsv(archive.bytes, archive.csvFileName)
  assert.equal(csv.split("\n").length, 1)
})

test("file sizes are shown in B, KB or MB", () => {
  assert.equal(formatFileSize(512), "512 B")
  assert.equal(formatFileSize(2048), "2.0 KB")
  assert.equal(formatFileSize(3.5 * 1024 * 1024), "3.5 MB")
})
