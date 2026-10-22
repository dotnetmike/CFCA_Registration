import { jsonError } from "@/lib/auth/api"
import { ReconciliationFileError } from "@/lib/reconciliation/parsers"
import {
  ReconciliationConflictError,
  ReconciliationValidationError,
} from "@/lib/reconciliation/service"

export const reconciliationErrorResponse = (err: unknown) => {
  if (err instanceof ReconciliationFileError || err instanceof ReconciliationValidationError) {
    return jsonError(err.message, 400)
  }
  if (err instanceof ReconciliationConflictError) return jsonError(err.message, 409)
  console.error("[reconcile]", err)
  return jsonError(err instanceof Error ? err.message : "Reconciliation failed", 500)
}
