import React from 'react'
import { notFound } from 'next/navigation'
import { AppShell } from '@/components/layout'
import { SETTINGS_SECTIONS } from '@/lib/settings-sections'

type SettingsSectionPageProps = {
  params: {
    section: string
  }
}

export function generateStaticParams() {
  return Object.keys(SETTINGS_SECTIONS).map(section => ({ section }))
}

export default function SettingsSectionPage({ params }: SettingsSectionPageProps) {
  const section = SETTINGS_SECTIONS[params.section]
  if (!section) {
    notFound()
  }

  const SectionComponent = section.component

  return (
    <AppShell
      title={section.title}
      subtitle={section.subtitle}
      showBackButton
      backButtonHref="/settings"
    >
      <SectionComponent />
    </AppShell>
  )
}

