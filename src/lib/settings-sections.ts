import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  Database,
  FileText,
  Gift,
  Settings,
  Table,
  User2,
  Wallet,
} from 'lucide-react'
import {
  DataManagement,
  NotificationPreferences,
  PayGuideSelector,
  PersonalInfoForm,
  TaxSettingsForm,
  DefaultPayPeriodExtrasSettings,
} from '@/components/settings'

export type SettingsCategory = 'Personal' | 'Pay & Tax' | 'Productivity' | 'Administration'

export type SettingsStatusKey = 'defaultPayGuide' | 'notifications'

export type SettingsSectionDescriptor = {
  slug: string
  title: string
  subtitle: string
  description: string
  component: ComponentType
  category: Exclude<SettingsCategory, 'Administration'>
  icon: LucideIcon
  statusKey?: SettingsStatusKey
}

export type SettingsCardConfig = {
  key: string
  href: string
  title: string
  description: string
  category: SettingsCategory
  icon: LucideIcon
  tone?: 'default' | 'admin'
  statusKey?: SettingsStatusKey
}

export const SETTINGS_SECTIONS = {
  personal: {
    slug: 'personal',
    title: 'Personal Information',
    subtitle: 'Profile and pay period',
    description: 'Name, email, timezone, pay period type',
    component: PersonalInfoForm,
    category: 'Personal',
    icon: User2,
  },
  'pay-guide': {
    slug: 'pay-guide',
    title: 'Pay Guide',
    subtitle: 'Choose a default pay guide',
    description: 'Choose a default pay guide',
    component: PayGuideSelector,
    category: 'Pay & Tax',
    icon: Wallet,
    statusKey: 'defaultPayGuide',
  },
  'pay-period-defaults': {
    slug: 'pay-period-defaults',
    title: 'Pay Period Extras',
    subtitle: 'Default allowances & deductions',
    description: 'Configure extras added to new pay periods',
    component: DefaultPayPeriodExtrasSettings,
    category: 'Pay & Tax',
    icon: Gift,
  },
  tax: {
    slug: 'tax',
    title: 'Tax Settings',
    subtitle: 'PAYG & Medicare',
    description: 'TFN, tax-free threshold, Medicare, HECS-HELP',
    component: TaxSettingsForm,
    category: 'Pay & Tax',
    icon: FileText,
  },
  notifications: {
    slug: 'notifications',
    title: 'Notifications',
    subtitle: 'Reminder preferences',
    description: 'Email and reminder preferences',
    component: NotificationPreferences,
    category: 'Productivity',
    icon: Bell,
    statusKey: 'notifications',
  },
  data: {
    slug: 'data',
    title: 'Data Management',
    subtitle: 'Export & preferences',
    description: 'Export data, import preferences',
    component: DataManagement,
    category: 'Productivity',
    icon: Database,
  },
} satisfies Record<string, SettingsSectionDescriptor>

export const SETTINGS_SECTION_LIST = Object.values(SETTINGS_SECTIONS) as SettingsSectionDescriptor[]

export const SETTINGS_CARD_ITEMS: SettingsCardConfig[] = [
  ...SETTINGS_SECTION_LIST.map(section => ({
    key: section.slug,
    href: `/settings/${section.slug}`,
    title: section.title,
    description: section.description,
    category: section.category,
    icon: section.icon,
    statusKey: section.statusKey,
  })),
  {
    key: 'pay-guides-manage',
    href: '/pay-guides',
    title: 'Pay Guides (Manage)',
    description: 'Add, edit, deactivate, or delete pay guides',
    category: 'Administration',
    icon: Settings,
    tone: 'admin',
  },
  {
    key: 'tax-tables',
    href: '/settings/tax-tables',
    title: 'Tax Tables (Admin)',
    description: 'PAYG coefficients and HECS thresholds',
    category: 'Administration',
    icon: Table,
    tone: 'admin',
  },
]
