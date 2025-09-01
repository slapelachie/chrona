import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import Navigation from '@/components/navigation'
import { SettingsProvider } from '@/contexts/settings-context'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Chrona - Australian Pay Tracker',
  description: 'Track your casual pay, forecast earnings, and verify payments',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SettingsProvider>
          <Navigation />
          <main className="min-h-screen bg-background">
            {children}
          </main>
        </SettingsProvider>
      </body>
    </html>
  )
}