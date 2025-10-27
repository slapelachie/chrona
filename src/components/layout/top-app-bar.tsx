'use client'

import React from 'react'
import { Button } from '../ui'
import { ArrowLeft, Bell } from 'lucide-react'
import './top-app-bar.scss'

interface TopAppBarProps {
  title?: string
  subtitle?: string
  showBackButton?: boolean
  onBackClick?: () => void
  actions?: React.ReactNode
  showNotifications?: boolean
  notificationCount?: number
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  title = 'Chrona',
  subtitle,
  showBackButton = false,
  onBackClick,
  actions,
  showNotifications = true,
  notificationCount = 0
}) => {
  return (
    <header className="top-app-bar safe-area-top">
      <div className="top-app-bar__container">
        <div className="top-app-bar__start">
          {showBackButton ? (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<ArrowLeft size={20} />}
              onClick={onBackClick}
              className="top-app-bar__back-button"
              aria-label="Go back"
            />
          ) : (
            <div className="top-app-bar__logo">
              <h1 className="top-app-bar__title">
                {title}
              </h1>
              {subtitle && (
                <p className="top-app-bar__subtitle">
                  {subtitle}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="top-app-bar__center">
          {showBackButton && (
            <div className="top-app-bar__logo">
              <h1 className="top-app-bar__title">
                {title}
              </h1>
              {subtitle && (
                <p className="top-app-bar__subtitle">
                  {subtitle}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="top-app-bar__end">
          {actions}
          {showNotifications && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Bell size={20} />}
              className="top-app-bar__notification-button"
              aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount})` : ''}`}
            >
              {notificationCount > 0 && (
                <span className="top-app-bar__notification-badge">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}