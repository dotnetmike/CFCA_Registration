import { config } from "dotenv"
import { existsSync } from "fs"
import { resolve } from "path"
import { envFilePath, resolveAppEnv } from "@/lib/env/app-env"

/**
 * Load environment variables for scripts (db deploy, repair, etc.).
 * Order: `.env.<APP_ENV>` then `.env.local` (overrides).
 * Does not fall back to a shared `.env` for Supabase keys — run `env:select` first.
 */
export const loadEnv = () => {
  let envName: string | null = null
  try {
    const resolved = resolveAppEnv()
    envName = resolved.env
    const envPath = envFilePath(resolved.env)
    if (existsSync(envPath)) {
      config({ path: envPath })
    }
  } catch {
    // APP_ENV may already be set in the process after env:select wrote .env.local;
    // still attempt .env.local below.
  }

  const localPath = resolve(process.cwd(), ".env.local")
  if (existsSync(localPath)) {
    config({ path: localPath, override: true })
  }

  if (!process.env.APP_ENV && envName) {
    process.env.APP_ENV = envName
  }
}
