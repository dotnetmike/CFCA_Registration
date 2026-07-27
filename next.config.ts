import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "pdf-parse", "prettier"],
}

export default nextConfig
