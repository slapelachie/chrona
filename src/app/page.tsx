import { AppShell } from '../components/layout'
import { Dashboard } from '../components/dashboard'
import { isAppInitialized } from '@/lib/initialization'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const initialized = await isAppInitialized()
  if (!initialized) redirect('/setup')

  return (
    <AppShell title="Dashboard" subtitle="Current Pay Period">
      <Dashboard />
    </AppShell>
  )
}
