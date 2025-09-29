import React from 'react'
import { notFound } from 'next/navigation'
import { AppShell } from '@/components/layout'
import { SETTINGS_SECTIONS } from '@/lib/settings-sections'

type SectionKey = keyof typeof SETTINGS_SECTIONS

type SettingsSectionPageProps = {
  params: Promise<{
    section: string
  }>
}

export function generateStaticParams() {
  return (Object.keys(SETTINGS_SECTIONS) as SectionKey[]).map(section => ({ section }))
}

export default async function SettingsSectionPage({ params }: SettingsSectionPageProps) {
  const { section: rawSection } = await params
  if (!isSectionKey(rawSection)) {
    notFound()
  }

  const section = SETTINGS_SECTIONS[rawSection]
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

function isSectionKey(value: string): value is SectionKey {
  return Object.prototype.hasOwnProperty.call(SETTINGS_SECTIONS, value)
}
