import type { Metadata } from "next"
import { Geist_Mono, Inter } from "next/font/google"

import { FundProvider } from "@/components/fund-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

import "./globals.css"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "KenBC Bereavement Fund",
  description: "Preview of the KenBC membership and bereavement fund desk.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>
          <FundProvider>
            {children}
            <Toaster />
          </FundProvider>
        </TooltipProvider>
      </body>
    </html>
  )
}
