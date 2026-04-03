import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({ subsets: ['latin'] });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
  default: "Sage - Bulk Minting",
  template: "%s | Sage - Bulk Minting",
  },
  description: "example",
  openGraph: {
    title: "Sage - Bulk Minting",
    description: "Tools for bulk minting nfts on chia network",
    images: ["/og.png"],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Sage - Bulk Minting",
    description: "Tools for bulk minting nfts on chia network",
    images: ["/og.png"],
  },
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
