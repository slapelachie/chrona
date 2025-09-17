import { AppShell } from '@/components/layout'
import { SetupForm } from '@/components/setup/setup-form'
import { isAppInitialized } from '@/lib/initialization'
import { redirect } from 'next/navigation'

export default async function SetupPage() {
  const initialized = await isAppInitialized()
  if (initialized) redirect('/')

  return (
    <AppShell showBottomNav={false} title="Welcome to Chrona" subtitle="Let’s set up your workspace">
      <SetupForm />
    </AppShell>
  )
}

