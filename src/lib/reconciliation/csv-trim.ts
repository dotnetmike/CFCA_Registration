/**
 * Drop empty / Excel-padded CSV lines (blank or only commas/quotes/whitespace).
 * Safe for CommBank and Stripe exports that do not put newlines inside quoted fields.
 * Keeps request bodies under Vercel's ~4.5 MB function limit when Excel pads to a million rows.
 */
export const trimEmptyCsvLines = (text: string) =>
  text
    .replace(/^\uFEFF/, "")
    .split(/\r\n|\n|\r/)
    .filter((line) => /[^,\s"]/.test(line))
    .join("\n")

/** Soft client-side ceiling under Vercel's serverless request body limit. */
export const RECONCILE_UPLOAD_MAX_BYTES = 4 * 1024 * 1024
