import type { Metadata } from "next"
import { AuthProvider } from "@/lib/auth/context"
import { SiteHeader } from "@/components/layout/site-header"
import { RequireAuth } from "@/components/auth/require-auth"
import "./globals.css"

export const metadata: Metadata = {
  title: "CFCA Conference Registration",
  description: "Register for the Couples for Christ Australia Conference",
}

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html lang="en">
    <body className="min-h-screen antialiased">
      <AuthProvider>
        <SiteHeader />
        <main className="cfca-main">
          <RequireAuth>{children}</RequireAuth>
        </main>
      </AuthProvider>
    </body>
  </html>
)

export default RootLayout
