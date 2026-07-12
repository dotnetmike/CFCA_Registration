export const TSHIRT_SIZES = ["S", "M", "L", "XL", "2XL"] as const

export type TshirtSize = (typeof TSHIRT_SIZES)[number]

export type SouvenirOrderLine = {
  size: TshirtSize
  quantity: number
}

export const TSHIRT_UNIT_PRICE = 30

export const TSHIRT_SIZE_LABELS: Record<TshirtSize, string> = {
  S: "Small (S)",
  M: "Medium (M)",
  L: "Large (L)",
  XL: "XL",
  "2XL": "2XL",
}

const isTshirtSize = (value: unknown): value is TshirtSize =>
  typeof value === "string" && (TSHIRT_SIZES as readonly string[]).includes(value)

export const normalizeSouvenirOrders = (value: unknown): SouvenirOrderLine[] => {
  if (!Array.isArray(value)) return []

  const bySize = new Map<TshirtSize, number>()
  for (const row of value) {
    if (!row || typeof row !== "object") continue
    const line = row as Record<string, unknown>
    if (!isTshirtSize(line.size)) continue
    const qty = Number(line.quantity ?? 0)
    if (!Number.isFinite(qty) || qty <= 0) continue
    bySize.set(line.size, (bySize.get(line.size) ?? 0) + Math.floor(qty))
  }

  return TSHIRT_SIZES
    .map((size) => ({ size, quantity: bySize.get(size) ?? 0 }))
    .filter((line) => line.quantity > 0)
}

export const souvenirTotalQuantity = (orders: unknown) =>
  normalizeSouvenirOrders(orders).reduce((sum, line) => sum + line.quantity, 0)

export const souvenirTotalAmount = (orders: unknown) =>
  souvenirTotalQuantity(orders) * TSHIRT_UNIT_PRICE

export const hasSouvenirPreOrder = (orders: unknown) => souvenirTotalQuantity(orders) > 0

export const formatSouvenirOrdersSummary = (orders: unknown) => {
  const lines = normalizeSouvenirOrders(orders)
  if (lines.length === 0) return "—"
  return lines
    .map((line) => `${line.quantity}× ${TSHIRT_SIZE_LABELS[line.size]}`)
    .join(", ")
}
