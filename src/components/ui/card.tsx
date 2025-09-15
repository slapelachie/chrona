'use client'

import React from 'react'
import { Card as BSCard, CardProps as BSCardProps } from 'react-bootstrap'
import './card.scss'

export interface CardProps extends Omit<BSCardProps, 'bg' | 'border'> {
  variant?: 'default' | 'elevated' | 'outlined' | 'ghost'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  interactive?: boolean
  loading?: boolean
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  interactive = false,
  loading = false,
  children,
  className = '',
  onClick,
  ...props
}) => {
  const baseClass = 'chrona-card'
  const variantClass = `chrona-card--${variant}`
  const paddingClass = `chrona-card--padding-${padding}`
  const interactiveClass = interactive ? 'chrona-card--interactive' : ''
  const loadingClass = loading ? 'chrona-card--loading' : ''
  
  const combinedClassName = [
    baseClass,
    variantClass,
    paddingClass,
    interactiveClass,
    loadingClass,
    className
  ].filter(Boolean).join(' ')

  const cardContent = loading ? (
    <div className="chrona-card__loading">
      <div className="skeleton skeleton--line skeleton--line-1"></div>
      <div className="skeleton skeleton--line skeleton--line-2"></div>
      <div className="skeleton skeleton--line skeleton--line-3"></div>
    </div>
  ) : (
    children
  )

  const cardProps = {
    ...props,
    className: combinedClassName,
    onClick: interactive ? onClick : undefined,
    role: interactive ? 'button' : undefined,
    tabIndex: interactive ? 0 : undefined,
    'aria-disabled': loading
  }

  return (
    <BSCard {...cardProps}>
      {cardContent}
    </BSCard>
  )
}

// Card sub-components for better composition
export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = ''
}) => (
  <BSCard.Header className={`chrona-card__header ${className}`}>
    {children}
  </BSCard.Header>
)

export const CardBody: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = ''
}) => (
  <BSCard.Body className={`chrona-card__body ${className}`}>
    {children}
  </BSCard.Body>
)

export const CardFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = ''
}) => (
  <BSCard.Footer className={`chrona-card__footer ${className}`}>
    {children}
  </BSCard.Footer>
)