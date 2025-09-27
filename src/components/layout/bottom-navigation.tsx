'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Calendar,
  Settings
} from 'lucide-react'
import './bottom-navigation.scss'

interface NavigationItem {
  href: string
  icon: React.ReactNode
  label: string
  badge?: number
}

const navigationItems: NavigationItem[] = [
  {
    href: '/',
    icon: <Home size={24} />,
    label: 'Dashboard'
  },
  {
    href: '/timeline',
    icon: <Calendar size={24} />,
    label: 'Timeline'
  },
  {
    href: '/settings',
    icon: <Settings size={24} />,
    label: 'Settings'
  }
]

export const BottomNavigation: React.FC = () => {
  const pathname = usePathname()

  return (
    <nav className="bottom-navigation safe-area-bottom" role="navigation" aria-label="Main navigation">
      <div className="bottom-navigation__container">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`bottom-navigation__item ${isActive ? 'bottom-navigation__item--active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="bottom-navigation__icon">
                {item.icon}
                {item.badge && (
                  <span className="bottom-navigation__badge" aria-label={`${item.badge} notifications`}>
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="bottom-navigation__label">
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
