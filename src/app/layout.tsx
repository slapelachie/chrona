import type { Metadata } from 'next'
import 'bootstrap/dist/css/bootstrap.min.css'

export const metadata: Metadata = {
  title: 'Chrona - Australian Casual Pay Tracker',
  description: 'Mobile-first Australian casual pay tracker with award compliance',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}