import { AppShell } from '../components/layout'
import { Dashboard } from '../components/dashboard'

export default function HomePage() {
  return (
    <AppShell 
      title="Dashboard"
      subtitle="Current Pay Period"
    >
      <Dashboard />
    </AppShell>
  )
}