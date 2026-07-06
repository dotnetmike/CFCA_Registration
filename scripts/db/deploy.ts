import { runDatabaseDeploy } from "@/lib/db/deploy"

runDatabaseDeploy().catch((err) => {
  console.error("[db] Deploy failed:", err)
  process.exit(1)
})
