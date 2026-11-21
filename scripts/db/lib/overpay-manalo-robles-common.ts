import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs"
import { resolve } from "path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { parseArgs } from "./backup-common"

export const NOTE_TAG = "[ops:overpay-manalo-robles]"

export const TARGETS = {
  candy: {
    id: "44a80982-a9e7-4e32-9bcd-e9d577bde02d",
    registrationNo: "CFCA27-000001",
  },
  marissa: {
    id: "4ff63783-aadd-4590-b0e3-3c8ca0d9aadc",
    registrationNo: "CFCA27-000026",
  },
  gladys: {
    id: "c6f2c0bd-3624-4b34-a228-deeba53713ef",
    registrationNo: "CFCA27-000070",
  },
  tita: {
    id: "4185e63a-f6f7-42f9-9b4c-b1c6acf033cd",
    registrationNo: "CFCA27-000086",
  },
  nitoDup: {
    id: "ce292894-e809-464c-9bcb-9ade1d8a1a54",
    registrationNo: "CFCA27-000087",
  },
} as const

/** Extra Marissa Fast Transfer still applied while amount_paid was manually set to 220. */
export const MARISSA_EXTRA_BANK_LINE_ID = "cb12cc46-a256-4c5a-a17b-64d1de2896b5"
export const STRIPE_PAYMENT_ID = "306ab2f1-49ad-4ec2-8b7c-bfb1d3fcc513"
export const STRIPE_PI = "pi_3UXAiPH5O1RdB1lo0TyxDijV"
/** Concurrent manual $440 on Candy — replaced by Stripe ledger move for tracking. */
export const CANDY_MANUAL_PAYMENT_ID = "0e7df576-c6a2-4c4e-ab03-ede68b1a0cfd"

export const SNAPSHOT_DIR = resolve(process.cwd(), "scripts/db/snapshots")

export type OpsSnapshot = {
  formatVersion: 2
  createdAt: string
  actorEmail: string
  actorId: string
  registrations: Record<string, Record<string, unknown>>
  paymentsByRegistration: Record<string, Record<string, unknown>[]>
  marissaExtraBankLine: Record<string, unknown>
  stripePayment: Record<string, unknown>
  candyManualPayment: Record<string, unknown> | null
  notesBefore: Record<string, Record<string, unknown>[]>
  emailLogForDeleted: Record<string, unknown>[]
  noteBodies: { candy: string; tita: string }
  createdNoteIds?: string[]
  stepsCompletedByOthers?: string[]
}

export const resolveActor = async (admin: SupabaseClient, actorEmail: string) => {
  const { data: actor, error } = await admin
    .from("users")
    .select("id, email, name")
    .ilike("email", actorEmail)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!actor) throw new Error(`No user with email ${actorEmail}`)
  return actor as { id: string; email: string; name: string }
}

export const loadOpsArgs = () => {
  const args = parseArgs()
  const apply = args.apply === true
  const actorEmail = typeof args.actor === "string" ? args.actor.trim().toLowerCase() : ""
  const snapshotPath = typeof args.snapshot === "string" ? args.snapshot.trim() : ""
  if (!actorEmail) throw new Error("Pass --actor <admin email>")
  return { apply, actorEmail, snapshotPath, args }
}

export const registrationIds = () => Object.values(TARGETS).map((t) => t.id)

export const fetchSnapshotData = async (
  admin: SupabaseClient
): Promise<
  Omit<OpsSnapshot, "createdAt" | "actorEmail" | "actorId" | "noteBodies" | "createdNoteIds" | "stepsCompletedByOthers">
> => {
  const ids = registrationIds()
  const { data: regs, error: regError } = await admin.from("registrations").select("*").in("id", ids)
  if (regError) throw new Error(regError.message)
  const registrations: Record<string, Record<string, unknown>> = {}
  for (const row of regs ?? []) {
    registrations[row.id as string] = row as Record<string, unknown>
  }

  const paymentsByRegistration: Record<string, Record<string, unknown>[]> = {}
  for (const id of ids) {
    const { data: pays, error } = await admin
      .from("payments")
      .select("*")
      .eq("registration_id", id)
      .order("created_at")
    if (error) throw new Error(error.message)
    paymentsByRegistration[id] = (pays ?? []) as Record<string, unknown>[]
  }

  const { data: marissaExtraBankLine, error: bankError } = await admin
    .from("bank_statement_lines")
    .select("*")
    .eq("id", MARISSA_EXTRA_BANK_LINE_ID)
    .maybeSingle()
  if (bankError) throw new Error(bankError.message)
  if (!marissaExtraBankLine) throw new Error(`Bank line ${MARISSA_EXTRA_BANK_LINE_ID} not found`)

  const { data: stripePayment, error: payError } = await admin
    .from("payments")
    .select("*")
    .eq("id", STRIPE_PAYMENT_ID)
    .maybeSingle()
  if (payError) throw new Error(payError.message)
  if (!stripePayment) throw new Error(`Stripe payment ${STRIPE_PAYMENT_ID} not found`)

  const { data: candyManualPayment, error: manualError } = await admin
    .from("payments")
    .select("*")
    .eq("id", CANDY_MANUAL_PAYMENT_ID)
    .maybeSingle()
  if (manualError) throw new Error(manualError.message)

  const notesBefore: Record<string, Record<string, unknown>[]> = {}
  for (const id of [TARGETS.candy.id, TARGETS.tita.id, TARGETS.nitoDup.id, TARGETS.gladys.id]) {
    const { data: notes, error } = await admin
      .from("registration_admin_notes")
      .select("*")
      .eq("registration_id", id)
      .order("created_at")
    if (error) throw new Error(error.message)
    notesBefore[id] = (notes ?? []) as Record<string, unknown>[]
  }

  const { data: emailLog, error: emailError } = await admin
    .from("email_log")
    .select("*")
    .eq("registration_id", TARGETS.nitoDup.id)
  if (emailError) throw new Error(emailError.message)

  return {
    formatVersion: 2,
    registrations,
    paymentsByRegistration,
    marissaExtraBankLine: marissaExtraBankLine as Record<string, unknown>,
    stripePayment: stripePayment as Record<string, unknown>,
    candyManualPayment: (candyManualPayment as Record<string, unknown> | null) ?? null,
    notesBefore,
    emailLogForDeleted: (emailLog ?? []) as Record<string, unknown>[],
  }
}

export const buildNoteBodies = () => {
  const candy = [
    NOTE_TAG,
    "Stripe ledger transferred from deleted duplicate CFCA27-000087 (Nito Manalo + Tita Manalo).",
    `PaymentIntent ${STRIPE_PI}, amount $440, payment id ${STRIPE_PAYMENT_ID}.`,
    "Attributed here for tracking: Candy Robles & Bing Robles paid via Nito Manalo.",
    "Replaced the concurrent manual $440 payment row with this Stripe ledger so amount paid stays $440.",
    "No Stripe refund. CFCA27-000086 (Tita/Nito) remains paid via bank transfer VIC_MANALO_001.",
  ].join(" ")

  const tita = [
    NOTE_TAG,
    "Duplicate registration CFCA27-000087 (Nito Manalo + Tita) deleted.",
    "This registration (CFCA27-000086) remains the couple record; bank $440 / VIC_MANALO_001 kept.",
    `Stripe $440 (${STRIPE_PI}) ledger moved to CFCA27-000001 (Candy/Bing Robles) for tracking — they paid via Nito. No Stripe refund.`,
  ].join(" ")

  return { candy, tita }
}

export const writeSnapshot = (snapshot: OpsSnapshot) => {
  mkdirSync(SNAPSHOT_DIR, { recursive: true })
  const stamp = snapshot.createdAt.replace(/[:.]/g, "-")
  const path = resolve(SNAPSHOT_DIR, `overpay-manalo-robles-${stamp}.json`)
  writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8")
  return path
}

export const readSnapshot = (path: string): OpsSnapshot => {
  if (!existsSync(path)) throw new Error(`Snapshot not found: ${path}`)
  return JSON.parse(readFileSync(path, "utf-8")) as OpsSnapshot
}

export const summarizeReg = (row: Record<string, unknown> | undefined) => {
  if (!row) return "(missing)"
  return `${row.registration_no} | ${row.given_name} ${row.surname} | due ${row.amount_due} paid ${row.amount_paid} | ${row.payment_status} | spouse ${row.spouse_given_name} ${row.spouse_surname}`
}

export const assertApplyPreconditions = (
  data: Awaited<ReturnType<typeof fetchSnapshotData>>
) => {
  const marissa = data.registrations[TARGETS.marissa.id]
  const gladys = data.registrations[TARGETS.gladys.id]
  const candy = data.registrations[TARGETS.candy.id]
  const tita = data.registrations[TARGETS.tita.id]
  const nito = data.registrations[TARGETS.nitoDup.id]
  const errors: string[] = []

  if (!marissa) errors.push("Marissa registration missing")
  else {
    if (Number(marissa.amount_due) !== 220) {
      errors.push(`Marissa amount_due expected 220, got ${marissa.amount_due}`)
    }
    if (Number(marissa.amount_paid) !== 220) {
      errors.push(`Marissa amount_paid expected 220 (already cleared), got ${marissa.amount_paid}`)
    }
    if (String(marissa.payment_status) !== "paid") {
      errors.push(`Marissa status expected paid, got ${marissa.payment_status}`)
    }
  }
  if (!gladys) errors.push("Gladys registration missing")
  else {
    if (Number(gladys.amount_paid) !== 220) {
      errors.push(`Gladys amount_paid expected 220 (already marked), got ${gladys.amount_paid}`)
    }
    if (String(gladys.payment_status) !== "paid") {
      errors.push(`Gladys status expected paid, got ${gladys.payment_status}`)
    }
  }
  if (!candy) errors.push("Candy registration missing")
  else {
    if (Number(candy.amount_due) !== 440) {
      errors.push(`Candy amount_due expected 440, got ${candy.amount_due}`)
    }
    if (Number(candy.amount_paid) !== 440) {
      errors.push(`Candy amount_paid expected 440 (already marked), got ${candy.amount_paid}`)
    }
  }
  if (!tita) errors.push("Tita registration missing")
  else if (Number(tita.amount_paid) !== 440) {
    errors.push(`Tita amount_paid expected 440, got ${tita.amount_paid}`)
  }
  if (!nito) errors.push("Nito duplicate CFCA27-000087 missing")
  else if (Number(nito.amount_paid) !== 440) {
    errors.push(`Nito dup amount_paid expected 440, got ${nito.amount_paid}`)
  }

  if (String(data.stripePayment.registration_id) !== TARGETS.nitoDup.id) {
    errors.push(
      `Stripe payment registration_id expected 000087, got ${data.stripePayment.registration_id}`
    )
  }
  if (Number(data.stripePayment.amount) !== 440) {
    errors.push(`Stripe payment amount expected 440, got ${data.stripePayment.amount}`)
  }
  if (String(data.marissaExtraBankLine.status) !== "matched") {
    errors.push(
      `Marissa Fast Transfer line expected matched (to reverse for ledger hygiene), got ${data.marissaExtraBankLine.status}`
    )
  }
  if (String(data.marissaExtraBankLine.matched_registration_id) !== TARGETS.marissa.id) {
    errors.push("Marissa Fast Transfer line not matched to Marissa")
  }

  if (errors.length) throw new Error(`Preconditions failed:\n- ${errors.join("\n- ")}`)
}
