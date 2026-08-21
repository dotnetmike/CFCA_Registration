import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuth, requirePermission, jsonError } from "@/lib/auth/api"
import { parseBankPdf } from "@/lib/payments/parse-bank-pdf"
import { sendRegistrationEmail } from "@/lib/email/send"
import { writeAuditLog } from "@/lib/audit/log"

export const POST = async (request: NextRequest) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const forbidden = requirePermission(auth, "payments:reconcile")
  if (forbidden) return forbidden

  const formData = await request.formData()
  const file = formData.get("file") as File | null

  if (!file) return jsonError("No file provided")
  if (file.type !== "application/pdf") return jsonError("Only PDF files are accepted")

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length > 10 * 1024 * 1024) return jsonError("File too large (max 10MB)")

  const admin = createAdminClient()
  const storagePath = `statements/${Date.now()}-${file.name}`

  await admin.storage.from("bank-statements").upload(storagePath, buffer, {
    contentType: "application/pdf",
    upsert: false,
  })

  const { data: statement, error: stmtError } = await admin
    .from("bank_statements")
    .insert({
      filename: file.name,
      storage_path: storagePath,
      uploaded_by: auth.sub,
      status: "processing",
    })
    .select()
    .single()

  if (stmtError) return jsonError(stmtError.message, 500)

  try {
    const { text, transactions } = await parseBankPdf(buffer)

    await admin
      .from("bank_statements")
      .update({ parsed_data: { text, transaction_count: transactions.length }, status: "completed" })
      .eq("id", statement.id)

    const results = []

    for (const txn of transactions) {
      const { data: byRegistrationNo } = await admin
        .from("registrations")
        .select("*")
        .eq("registration_no", txn.extracted_reference)
        .maybeSingle()

      const { data: byParticipantRef } = byRegistrationNo
        ? { data: null }
        : await admin
            .from("registrations")
            .select("*")
            .eq("participant_reference", txn.extracted_reference)
            .maybeSingle()

      const registration = byRegistrationNo ?? byParticipantRef

      let matchStatus: "auto_matched" | "unmatched" = "unmatched"
      let matchedId: string | null = null

      if (registration && txn.amount >= Number(registration.amount_due)) {
        const { data: existingPayment } = await admin
          .from("payments")
          .select("id")
          .eq("registration_id", registration.id)
          .eq("reference_text", txn.extracted_reference)
          .eq("amount", txn.amount)
          .maybeSingle()

        if (!existingPayment) {
          await admin.from("payments").insert({
            registration_id: registration.id,
            amount: txn.amount,
            reference_text: txn.extracted_reference,
            source: "bank_reconcile",
            bank_statement_id: statement.id,
            created_by: auth.sub,
          })

          const newPaid = Number(registration.amount_paid) + txn.amount
          const amountDue = Number(registration.amount_due)
          let paymentStatus: "paid" | "partial" | "overpaid" = "paid"
          if (newPaid < amountDue) paymentStatus = "partial"
          if (newPaid > amountDue) paymentStatus = "overpaid"

          await admin
            .from("registrations")
            .update({
              amount_paid: newPaid,
              payment_status: paymentStatus,
              payment_last_updated_source: "bank_reconcile",
              payment_last_updated_at: new Date().toISOString(),
              payment_last_updated_by: auth.sub,
            })
            .eq("id", registration.id)

          const updated = { ...registration, amount_paid: newPaid, payment_status: paymentStatus }
          await sendRegistrationEmail(updated, "payment_received", { request })

          await writeAuditLog({
            userId: auth.sub,
            action: "payment.record",
            previousValue: {
              amount_paid: registration.amount_paid,
              payment_status: registration.payment_status,
            },
            updatedValue: {
              amount_paid: newPaid,
              payment_status: paymentStatus,
            },
            metadata: {
              registration_id: registration.id,
              amount: txn.amount,
              reference: txn.extracted_reference,
            },
            request,
          })
        }

        matchStatus = "auto_matched"
        matchedId = registration.id
      }

      await admin.from("bank_transactions").insert({
        bank_statement_id: statement.id,
        transaction_date: txn.transaction_date,
        description: txn.description,
        amount: txn.amount,
        extracted_reference: txn.extracted_reference,
        matched_registration_id: matchedId,
        match_confidence: txn.match_confidence,
        match_status: matchStatus,
      })

      results.push({ reference: txn.extracted_reference, amount: txn.amount, matchStatus })
    }

    await writeAuditLog({
      userId: auth.sub,
      action: "payment.reconcile",
      updatedValue: {
        statement_id: statement.id,
        filename: file.name,
        matched: results.filter((r) => r.matchStatus === "auto_matched").length,
        unmatched: results.filter((r) => r.matchStatus === "unmatched").length,
      },
      metadata: { results },
      request,
    })

    return NextResponse.json({
      statementId: statement.id,
      matched: results.filter((r) => r.matchStatus === "auto_matched").length,
      unmatched: results.filter((r) => r.matchStatus === "unmatched").length,
      results,
    })
  } catch (err) {
    await admin
      .from("bank_statements")
      .update({ status: "failed" })
      .eq("id", statement.id)

    return jsonError(err instanceof Error ? err.message : "Parse failed", 500)
  }
}

export const GET = async (request: NextRequest) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const forbidden = requirePermission(auth, "payments:reconcile")
  if (forbidden) return forbidden

  const admin = createAdminClient()
  const { data: statements } = await admin
    .from("bank_statements")
    .select("*, bank_transactions(*)")
    .order("created_at", { ascending: false })
    .limit(20)

  return NextResponse.json({ statements: statements ?? [] })
}
