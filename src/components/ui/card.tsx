import React from 'react'
import { classNames } from '@/lib/utils'

export interface CardProps {
  className?: string
  hover?: boolean
  children?: React.ReactNode
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, hover, children, ...props }, ref) => {
    const cardClass = classNames(
      'card',
      hover && 'pay-card',
      className
    )

    return (
      <div ref={ref} className={cardClass} {...props}>
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

// Card sub-components
export const CardHeader: React.FC<{ className?: string; children?: React.ReactNode }> = ({ 
  className, 
  children 
}) => (
  <div className={classNames('card-header', className)}>
    {children}
  </div>
)

export const CardBody: React.FC<{ className?: string; children?: React.ReactNode }> = ({ 
  className, 
  children 
}) => (
  <div className={classNames('card-body', className)}>
    {children}
  </div>
)

export const CardTitle: React.FC<{ className?: string; children?: React.ReactNode }> = ({ 
  className, 
  children 
}) => (
  <h5 className={classNames('card-title', className)}>
    {children}
  </h5>
)

export const CardText: React.FC<{ className?: string; children?: React.ReactNode }> = ({ 
  className, 
  children 
}) => (
  <p className={classNames('card-text', className)}>
    {children}
  </p>
)

// Alias for consistency with shadcn naming
export const CardContent = CardBody
export const CardDescription = CardText