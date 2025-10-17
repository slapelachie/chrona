'use client'

import React, { forwardRef } from 'react'
import { Form } from 'react-bootstrap'
import './select.scss'

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string
  helpText?: string
  error?: string
  size?: 'sm' | 'md' | 'lg'
  required?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  helpText,
  error,
  size = 'md',
  className = '',
  id,
  required,
  disabled,
  children,
  ...props
}, ref) => {
  const selectId = id || `select-${Math.random().toString(36).slice(2, 9)}`
  const hasError = Boolean(error)

  const wrapperClassName = [
    'chrona-select',
    `chrona-select--${size}`,
    hasError ? 'chrona-select--error' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={wrapperClassName}>
      {label && (
        <Form.Label htmlFor={selectId} className="chrona-select__label">
          {label}
          {required && <span className="chrona-select__required" aria-label="required">*</span>}
        </Form.Label>
      )}

      <div className="chrona-select__wrapper">
        <Form.Select
          {...props}
          id={selectId}
          ref={ref}
          className="chrona-select__field"
          disabled={disabled}
          aria-invalid={hasError}
          aria-describedby={
            [
              helpText && `${selectId}-help`,
              error && `${selectId}-error`,
            ].filter(Boolean).join(' ') || undefined
          }
        >
          {children}
        </Form.Select>
      </div>

      {helpText && !error && (
        <Form.Text id={`${selectId}-help`} className="chrona-select__help">
          {helpText}
        </Form.Text>
      )}

      {error && (
        <div id={`${selectId}-error`} className="chrona-select__error" role="alert">
          {error}
        </div>
      )}
    </div>
  )
})

Select.displayName = 'Select'

