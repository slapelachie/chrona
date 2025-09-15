'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { BottomNavigation } from './bottom-navigation'
import { TopAppBar } from './top-app-bar'
import './app-shell.scss'

interface AppShellProps {
  children: React.ReactNode
  showTopBar?: boolean
  showBottomNav?: boolean
  title?: string
  subtitle?: string
  actions?: React.ReactNode
  showBackButton?: boolean
  backButtonHref?: string
  onBackClick?: () => void
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  showTopBar = true,
  showBottomNav = true,
  title,
  subtitle,
  actions,
  showBackButton = false,
  backButtonHref,
  onBackClick
}) => {
  const router = useRouter()

  const handleBackClick = () => {
    if (onBackClick) {
      onBackClick()
    } else if (backButtonHref) {
      router.push(backButtonHref)
    } else {
      router.back()
    }
  }
  return (
    <div className="app-shell">
      {showTopBar && (
        <TopAppBar 
          title={title}
          subtitle={subtitle}
          actions={actions}
          showBackButton={showBackButton}
          onBackClick={handleBackClick}
        />
      )}
      
      <main className={`app-shell__main ${showTopBar ? 'app-shell__main--with-top-bar' : ''} ${showBottomNav ? 'app-shell__main--with-bottom-nav' : ''}`}>
        <div className="app-shell__content mobile-container">
          {children}
        </div>
      </main>
      
      {showBottomNav && <BottomNavigation />}
    </div>
  )
}