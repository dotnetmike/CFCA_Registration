/** Stripe Online Payment is enabled when the secret key is set. */
export const isStripePaymentsEnabled = (): boolean =>
  Boolean(String(process.env.STRIPE_SECRET_KEY ?? "").trim())
