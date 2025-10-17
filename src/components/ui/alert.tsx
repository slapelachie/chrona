'use client'

import React from 'react'
import './alert.scss'

type AlertTone = 'info' | 'success' | 'warning' | 'danger'

export interface AlertProps {
  tone?: AlertTone
  title?: string
  children: React.ReactNode
  className?: string
  role?: 'alert' | 'status'
}

const toneToRole: Record<AlertTone, 'alert' | 'status'> = {
  info: 'status',
  success: 'status',
  warning: 'status',
  danger: 'alert',
}

export const Alert: React.FC<AlertProps> = ({
  tone = 'info',
  title,
  children,
  className = '',
  role,
}) => {
  const wrapperClassName = [
    'chrona-alert',
    `chrona-alert--${tone}`,
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={wrapperClassName} role={role || toneToRole[tone]}>
      <div className="chrona-alert__content">
        {title && <div className="chrona-alert__title">{title}</div>}
        <div className="chrona-alert__body">{children}</div>
      </div>
    </div>
  )
}

