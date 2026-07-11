/**
 * Stamp synced_commit / synced_at on all product specs to current HEAD.
 * Usage: npm run specs:stamp
 */
import { execSync } from "child_process"
import { readdirSync, readFileSync, writeFileSync, statSync } from "fs"
import { join } from "path"

const ROOT = join(process.cwd(), "specs")
const DIRS = [join(ROOT, "global"), join(ROOT, "features")]

const shortSha = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim()
const syncedAt = new Date().toISOString().slice(0, 10)

const listMarkdown = (dir: string): string[] => {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return []
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => join(dir, name))
}

const stampFile = (path: string) => {
  const original = readFileSync(path, "utf8")
  if (!original.startsWith("---")) {
    console.warn(`[specs:stamp] skip (no frontmatter): ${path}`)
    return false
  }

  const end = original.indexOf("\n---", 3)
  if (end < 0) {
    console.warn(`[specs:stamp] skip (bad frontmatter): ${path}`)
    return false
  }

  let front = original.slice(0, end + 4)
  const body = original.slice(end + 4)

  if (/^synced_commit:/m.test(front)) {
    front = front.replace(/^synced_commit:.*$/m, `synced_commit: ${shortSha}`)
  } else {
    front = front.replace(/^---\n/, `---\nsynced_commit: ${shortSha}\n`)
  }

  if (/^synced_at:/m.test(front)) {
    front = front.replace(/^synced_at:.*$/m, `synced_at: ${syncedAt}`)
  } else {
    front = front.replace(/^synced_commit:.*$/m, (line) => `${line}\nsynced_at: ${syncedAt}`)
  }

  const next = front + body
  if (next === original) {
    console.log(`[specs:stamp] unchanged ${path}`)
    return false
  }

  writeFileSync(path, next, "utf8")
  console.log(`[specs:stamp] updated ${path}`)
  return true
}

let count = 0
for (const dir of DIRS) {
  for (const file of listMarkdown(dir)) {
    if (stampFile(file)) count += 1
  }
}

console.log(`[specs:stamp] HEAD=${shortSha} date=${syncedAt} files_updated=${count}`)
