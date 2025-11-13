import '@/polyfills'
import type { Metadata } from 'next'
import './globals.css'

// Use system fonts for offline build capability
const fontClass = 'font-sans'

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
      <body className={fontClass}>
        {children}
      </body>
    </html>
  )
}
