'use client'

import React, { forwardRef } from 'react'
import { Form } from 'react-bootstrap'
import './input.scss'

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'value'> {
  label?: string
  helpText?: string
  error?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'filled'
  isLoading?: boolean
  value?: string | number | string[]
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  helpText,
  error,
  leftIcon,
  rightIcon,
  size = 'md',
  variant = 'default',
  isLoading = false,
  className = '',
  id,
  required,
  disabled,
  ...props
}, ref) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`
  const hasError = !!error
  const hasIcons = !!(leftIcon || rightIcon)
  
  const baseClass = 'chrona-input'
  const variantClass = `chrona-input--${variant}`
  const sizeClass = `chrona-input--${size}`
  const errorClass = hasError ? 'chrona-input--error' : ''
  const iconsClass = hasIcons ? 'chrona-input--with-icons' : ''
  const loadingClass = isLoading ? 'chrona-input--loading' : ''
  
  const wrapperClassName = [
    baseClass,
    variantClass,
    sizeClass,
    errorClass,
    iconsClass,
    loadingClass,
    className
  ].filter(Boolean).join(' ')

  return (
    <div className={wrapperClassName}>
      {label && (
        <Form.Label htmlFor={inputId} className="chrona-input__label">
          {label}
          {required && <span className="chrona-input__required" aria-label="required">*</span>}
        </Form.Label>
      )}
      
      <div className="chrona-input__wrapper">
        {leftIcon && (
          <span className="chrona-input__icon chrona-input__icon--left">
            {leftIcon}
          </span>
        )}
        
        <Form.Control
          {...props}
          ref={ref}
          id={inputId}
          className="chrona-input__field"
          disabled={disabled || isLoading}
          aria-invalid={hasError}
          aria-describedby={
            [
              helpText && `${inputId}-help`,
              error && `${inputId}-error`
            ].filter(Boolean).join(' ') || undefined
          }
        />
        
        {rightIcon && (
          <span className="chrona-input__icon chrona-input__icon--right">
            {rightIcon}
          </span>
        )}
        
        {isLoading && (
          <span className="chrona-input__loading">
            <span className="spinner-border spinner-border-sm" role="status">
              <span className="sr-only">Loading...</span>
            </span>
          </span>
        )}
      </div>
      
      {helpText && !error && (
        <Form.Text id={`${inputId}-help`} className="chrona-input__help">
          {helpText}
        </Form.Text>
      )}
      
      {error && (
        <div id={`${inputId}-error`} className="chrona-input__error" role="alert">
          {error}
        </div>
      )}
    </div>
  )
})

Input.displayName = 'Input'
