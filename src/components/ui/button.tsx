'use client'

import React from 'react'
import { Button as BSButton, ButtonProps as BSButtonProps } from 'react-bootstrap'
import './button.scss'

export interface ButtonProps extends Omit<BSButtonProps, 'variant' | 'size'> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  loadingText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  fullWidth?: boolean
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loadingText,
  leftIcon,
  rightIcon,
  fullWidth = false,
  children,
  disabled,
  className = '',
  ...props
}) => {
  const baseClass = 'chrona-btn'
  const variantClass = `chrona-btn--${variant}`
  const sizeClass = `chrona-btn--${size}`
  const fullWidthClass = fullWidth ? 'chrona-btn--full-width' : ''
  const loadingClass = isLoading ? 'chrona-btn--loading' : ''
  
  const combinedClassName = [
    baseClass,
    variantClass,
    sizeClass,
    fullWidthClass,
    loadingClass,
    className
  ].filter(Boolean).join(' ')

  const buttonContent = (
    <>
      {isLoading && (
        <span className="chrona-btn__spinner" aria-hidden="true">
          <span className="spinner-border spinner-border-sm" role="status">
            <span className="sr-only">Loading...</span>
          </span>
        </span>
      )}
      {!isLoading && leftIcon && (
        <span className="chrona-btn__icon chrona-btn__icon--left">
          {leftIcon}
        </span>
      )}
      <span className="chrona-btn__text">
        {isLoading && loadingText ? loadingText : children}
      </span>
      {!isLoading && rightIcon && (
        <span className="chrona-btn__icon chrona-btn__icon--right">
          {rightIcon}
        </span>
      )}
    </>
  )

  const bootstrapSize = size === 'md' ? undefined : size

  return (
    <BSButton
      {...props}
      className={combinedClassName}
      disabled={disabled || isLoading}
      aria-disabled={disabled || isLoading}
      size={bootstrapSize}
    >
      {buttonContent}
    </BSButton>
  )
}
