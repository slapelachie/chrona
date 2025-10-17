'use client'

import React from 'react'
import './toggle.scss'

export interface ToggleProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  description?: string
}

export const Toggle: React.FC<ToggleProps> = ({
  label,
  description,
  className = '',
  disabled,
  ...props
}) => {
  const id = props.id || `toggle-${Math.random().toString(36).slice(2, 9)}`

  const wrapperClassName = [
    'chrona-toggle',
    disabled ? 'chrona-toggle--disabled' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <label htmlFor={id} className={wrapperClassName}>
      <input
        {...props}
        id={id}
        type="checkbox"
        className="chrona-toggle__input"
        disabled={disabled}
      />
      <span className="chrona-toggle__control" aria-hidden />
      <span className="chrona-toggle__content">
        <span className="chrona-toggle__label">{label}</span>
        {description && (
          <span className="chrona-toggle__description">{description}</span>
        )}
      </span>
    </label>
  )
}

