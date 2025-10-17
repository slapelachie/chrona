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
type CardSectionPadding = 'none' | 'sm' | 'md' | 'lg'

type SectionProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode
  className?: string
  padding?: CardSectionPadding
}

const paddingValueMap: Record<CardSectionPadding, string> = {
  none: '0',
  sm: 'var(--spacing-sm)',
  md: 'var(--spacing-md)',
  lg: 'var(--spacing-lg)'
}

const resolveSectionProps = (
  base: string,
  className: string,
  padding: CardSectionPadding | undefined,
  style: React.CSSProperties | undefined
) => {
  const paddingStyle = padding ? { padding: paddingValueMap[padding] } : undefined
  const mergedStyle = paddingStyle ? { ...paddingStyle, ...style } : style
  const mergedClassName = [base, className].filter(Boolean).join(' ')
  return { className: mergedClassName, style: mergedStyle }
}

export const CardHeader: React.FC<SectionProps> = ({
  children,
  className = '',
  padding,
  style,
  ...rest
}) => (
  <BSCard.Header
    {...resolveSectionProps('chrona-card__header', className, padding, style)}
    {...rest}
  >
    {children}
  </BSCard.Header>
)

export const CardBody: React.FC<SectionProps> = ({
  children,
  className = '',
  padding,
  style,
  ...rest
}) => (
  <BSCard.Body
    {...resolveSectionProps('chrona-card__body', className, padding, style)}
    {...rest}
  >
    {children}
  </BSCard.Body>
)

export const CardFooter: React.FC<SectionProps> = ({
  children,
  className = '',
  padding,
  style,
  ...rest
}) => (
  <BSCard.Footer
    {...resolveSectionProps('chrona-card__footer', className, padding, style)}
    {...rest}
  >
    {children}
  </BSCard.Footer>
)
