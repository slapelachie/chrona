import type { ComponentType } from 'react'
import {
  DataManagement,
  NotificationPreferences,
  PayGuideSelector,
  PersonalInfoForm,
  TaxSettingsForm,
} from '@/components/settings'

export type SettingsSectionDescriptor = {
  slug: string
  title: string
  subtitle: string
  description: string
  component: ComponentType
}

export const SETTINGS_SECTIONS = {
  personal: {
    slug: 'personal',
    title: 'Personal Information',
    subtitle: 'Profile and pay period',
    description: 'Name, email, timezone, pay period type',
    component: PersonalInfoForm,
  },
  'pay-guide': {
    slug: 'pay-guide',
    title: 'Pay Guide',
    subtitle: 'Choose a default pay guide',
    description: 'Choose a default pay guide',
    component: PayGuideSelector,
  },
  tax: {
    slug: 'tax',
    title: 'Tax Settings',
    subtitle: 'PAYG & Medicare',
    description: 'TFN, tax-free threshold, Medicare, HECS-HELP',
    component: TaxSettingsForm,
  },
  notifications: {
    slug: 'notifications',
    title: 'Notifications',
    subtitle: 'Reminder preferences',
    description: 'Email and reminder preferences',
    component: NotificationPreferences,
  },
  data: {
    slug: 'data',
    title: 'Data Management',
    subtitle: 'Export & preferences',
    description: 'Export data, import preferences',
    component: DataManagement,
  },
} satisfies Record<string, SettingsSectionDescriptor>

export const SETTINGS_SECTION_LIST = Object.values(SETTINGS_SECTIONS)

