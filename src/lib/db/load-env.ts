import { config } from "dotenv"
import { resolve } from "path"

export const loadEnv = () => {
  config({ path: resolve(process.cwd(), ".env.local") })
  config({ path: resolve(process.cwd(), ".env") })
}
