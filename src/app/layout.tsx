import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { AuthProvider } from "@/lib/auth/context"
import { SiteHeader } from "@/components/layout/site-header"
import { RequireAuth } from "@/components/auth/require-auth"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "CFCA Conference Registration",
  description: "Register for the CFCA Conference",
}

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html lang="en">
    <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-gray-50 antialiased`}>
      <AuthProvider>
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-8">
          <RequireAuth>{children}</RequireAuth>
        </main>
      </AuthProvider>
    </body>
  </html>
)

export default RootLayout
