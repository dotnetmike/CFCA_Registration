import { execSync } from "child_process"
import { existsSync } from "fs"
import { resolve } from "path"

export const APP_ENVS = ["dev", "uat", "production"] as const
export type AppEnv = (typeof APP_ENVS)[number]

const BRANCH_TO_ENV: Record<string, AppEnv> = {
  dev: "dev",
  uat: "uat",
  master: "production",
  main: "production",
}

export const isAppEnv = (value: string | undefined | null): value is AppEnv =>
  !!value && (APP_ENVS as readonly string[]).includes(value)

export const getGitBranch = (): string | null => {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
    if (!branch || branch === "HEAD") return null
    return branch
  } catch {
    return null
  }
}

export type ResolveAppEnvResult = {
  env: AppEnv
  source: "APP_ENV" | "cli" | "git-branch"
  branch: string | null
}

/**
 * Resolve which app environment to use.
 * Priority: explicit override (CLI / caller) → process.env.APP_ENV → git branch.
 */
export const resolveAppEnv = (override?: string | null): ResolveAppEnvResult => {
  const branch = getGitBranch()

  if (override && isAppEnv(override)) {
    return { env: override, source: "cli", branch }
  }

  if (isAppEnv(process.env.APP_ENV)) {
    return { env: process.env.APP_ENV, source: "APP_ENV", branch }
  }

  if (branch) {
    const mapped = BRANCH_TO_ENV[branch.toLowerCase()]
    if (mapped) {
      return { env: mapped, source: "git-branch", branch }
    }
  }

  const branchHint = branch
    ? `Current branch "${branch}" is not mapped. Use APP_ENV=dev|uat|production, or checkout dev / uat / master.`
    : "Could not detect git branch. Set APP_ENV=dev|uat|production."

  throw new Error(
    `[env] Unable to resolve APP_ENV.\n${branchHint}\nExpected branches: ${Object.keys(BRANCH_TO_ENV).join(", ")}`
  )
}

export const envFileName = (env: AppEnv) => `.env.${env}`

export const envExampleFileName = (env: AppEnv) => `.env.${env}.example`

export const envFilePath = (env: AppEnv, cwd = process.cwd()) =>
  resolve(cwd, envFileName(env))

export const requireEnvFile = (env: AppEnv, cwd = process.cwd()) => {
  const path = envFilePath(env, cwd)
  if (!existsSync(path)) {
    throw new Error(
      `[env] Missing ${envFileName(env)}. Copy ${envExampleFileName(env)} → ${envFileName(env)} and fill in secrets for this environment.`
    )
  }
  return path
}
