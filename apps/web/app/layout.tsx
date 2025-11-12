import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SabiScore - AI-Powered Football Predictions',
  description: 'Advanced football match predictions with 73.7% accuracy, +18.4% ROI, and ₦60 average CLV using ensemble AI models',
  keywords: 'football predictions, AI betting, value bets, match predictions, football analytics, sports betting',
  authors: [{ name: 'SabiScore' }],
  openGraph: {
    title: 'SabiScore - AI-Powered Football Predictions',
    description: 'Advanced football match predictions with 73.7% accuracy and +18.4% ROI',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}
