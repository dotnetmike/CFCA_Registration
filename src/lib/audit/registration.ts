export const REGISTRATION_AUDIT_FIELDS = [
  "registration_no",
  "participant_reference",
  "surname",
  "given_name",
  "email",
  "mobile",
  "dietary_requirements",
  "state",
  "cfca_position",
  "spouse_attending",
  "spouse_dietary_requirements",
  "accommodation_type",
  "pickup_melbourne_airport",
  "dropoff_melbourne_airport",
  "pickup_transport_contact_name",
  "pickup_transport_contact_phone",
  "dropoff_transport_contact_name",
  "dropoff_transport_contact_phone",
  "souvenir_orders",
  "amount_due",
  "amount_paid",
  "payment_status",
  "payment_last_updated_source",
  "payment_last_updated_at",
  "payment_last_updated_by",
  "submitted_at",
] as const

export const pickRegistrationAuditSnapshot = (record: Record<string, unknown>) =>
  Object.fromEntries(
    REGISTRATION_AUDIT_FIELDS.filter((key) => key in record).map((key) => [key, record[key]])
  )
