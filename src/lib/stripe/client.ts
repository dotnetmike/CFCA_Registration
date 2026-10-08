import Stripe from "stripe"
import { isStripePaymentsEnabled } from "@/lib/stripe/config"

let stripeClient: Stripe | null = null

export const getStripe = (): Stripe | null => {
  if (!isStripePaymentsEnabled()) return null
  const key = String(process.env.STRIPE_SECRET_KEY ?? "").trim()
  if (!key) return null
  if (!stripeClient) {
    stripeClient = new Stripe(key)
  }
  return stripeClient
}
