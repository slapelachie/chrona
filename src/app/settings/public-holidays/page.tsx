import { AppShell } from '@/components/layout'
import { PublicHolidayManager } from '@/components/settings'

export default function PublicHolidaysSettingsPage() {
  return (
    <AppShell
      title="Public Holidays"
      subtitle="Manage holiday calendars for each pay guide"
      showBackButton
      backButtonHref="/settings"
    >
      <PublicHolidayManager />
    </AppShell>
  )
}

