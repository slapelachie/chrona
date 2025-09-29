import { AppShell } from '@/components/layout'
import { StatisticsView } from '@/components/statistics'

export default function StatisticsPage() {
  return (
    <AppShell
      title="Statistics"
      subtitle="Financial Year Overview"
    >
      <StatisticsView />
    </AppShell>
  )
}
