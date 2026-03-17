"use client";
console.log("[LAYOUT] layout.tsx loaded");
import './globals.css'
import MsalProviderWrapper from '@/components/auth/MsalProviderWrapper'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-[#181e29]">
      <body className="bg-[#181e29] text-white font-inter">
        <MsalProviderWrapper>{children}</MsalProviderWrapper>
      </body>
    </html>
  )
}