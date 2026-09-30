export type RegistrationWorkflow = "v1" | "v2"

export const DEFAULT_REGISTRATION_WORKFLOW: RegistrationWorkflow = "v1"

export const parseRegistrationWorkflow = (value: unknown): RegistrationWorkflow => {
  const raw = String(value ?? "").trim().toLowerCase()
  return raw === "v2" ? "v2" : "v1"
}

/** Env override for local emergency only. Empty = use DB setting. */
export const getEnvWorkflowOverride = (): RegistrationWorkflow | null => {
  const raw = String(process.env.REGISTRATION_WORKFLOW ?? "").trim().toLowerCase()
  if (raw === "v1" || raw === "v2") return raw
  return null
}

export const resolveRegistrationWorkflow = (
  dbWorkflow: RegistrationWorkflow
): RegistrationWorkflow => getEnvWorkflowOverride() ?? dbWorkflow
