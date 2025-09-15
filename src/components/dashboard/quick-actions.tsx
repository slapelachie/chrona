'use client'

import React from 'react'
import { Button } from '../ui'
import { Plus, FileText, Download, Calculator } from 'lucide-react'
import './quick-actions.scss'

export const QuickActions: React.FC = () => {
  const actions = [
    {
      label: 'Add Shift',
      icon: <Plus size={20} />,
      variant: 'primary' as const,
      onClick: () => console.log('Add shift clicked'),
      isPrimary: true
    },
    {
      label: 'View Pay Slip',
      icon: <FileText size={20} />,
      variant: 'outline' as const,
      onClick: () => console.log('View pay slip clicked')
    },
    {
      label: 'Export Data',
      icon: <Download size={20} />,
      variant: 'outline' as const,
      onClick: () => console.log('Export data clicked')
    },
    {
      label: 'Tax Calculator',
      icon: <Calculator size={20} />,
      variant: 'outline' as const,
      onClick: () => console.log('Tax calculator clicked')
    }
  ]

  return (
    <div className="quick-actions">
      <h2 className="quick-actions__title">Quick Actions</h2>
      
      <div className="quick-actions__grid">
        {actions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant}
            leftIcon={action.icon}
            onClick={action.onClick}
            className={`quick-actions__button ${action.isPrimary ? 'quick-actions__button--primary' : ''}`}
            size="lg"
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  )
}