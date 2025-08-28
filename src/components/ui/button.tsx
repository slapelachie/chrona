import React from 'react'
import { classNames } from '@/lib/utils'

export interface ButtonProps {
  className?: string
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark' | 'outline-primary' | 'outline-secondary'
  size?: 'sm' | 'lg'
  fullWidth?: boolean
  loading?: boolean
  disabled?: boolean
  children?: React.ReactNode
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  type?: 'button' | 'submit' | 'reset'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size, fullWidth, loading, children, disabled, type = 'button', ...props }, ref) => {
    const buttonClass = classNames(
      'btn',
      `btn-${variant}`,
      size && `btn-${size}`,
      fullWidth && 'w-100',
      loading && 'position-relative',
      className
    )

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={buttonClass}
        {...props}
      >
        {loading && (
          <span className="position-absolute top-50 start-50 translate-middle">
            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
          </span>
        )}
        <span className={loading ? 'invisible' : undefined}>
          {children}
        </span>
      </button>
    )
  }
)

Button.displayName = 'Button'