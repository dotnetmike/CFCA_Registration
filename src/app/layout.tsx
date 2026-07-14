import type { Metadata } from "next"
import { Cormorant_Garamond, Source_Sans_3 } from "next/font/google"
import { AuthProvider } from "@/lib/auth/context"
import { SiteHeader } from "@/components/layout/site-header"
import { RequireAuth } from "@/components/auth/require-auth"
import "./globals.css"

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  display: "swap",
})

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "CFCA Conference Registration",
  description: "Register for the CFCA Conference",
}

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html lang="en">
    <body
      className={`${sourceSans.variable} ${cormorant.variable} min-h-screen antialiased`}
    >
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
