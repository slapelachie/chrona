'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import { type PayRate, type ShiftFormData } from '@/types'
import ShiftForm from './shift-form'

interface ShiftQuickAddProps {
  payRates: PayRate[]
  onShiftCreated?: (shift: any) => void
  triggerText?: string
  triggerVariant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
}

export default function ShiftQuickAdd({
  payRates,
  onShiftCreated,
  triggerText = 'Add Shift',
  triggerVariant = 'default'
}: ShiftQuickAddProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (data: ShiftFormData) => {
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/shifts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to create shift')
      }

      const shift = await response.json()
      onShiftCreated?.(shift)
      setOpen(false)
    } catch (error) {
      console.error('Error creating shift:', error)
      // TODO: Add proper error handling/toast notification
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {triggerText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Shift</DialogTitle>
          <DialogDescription>
            Create a new shift entry with automatic pay calculations.
          </DialogDescription>
        </DialogHeader>
        <ShiftForm
          payRates={payRates}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={isLoading}
        />
      </DialogContent>
    </Dialog>
  )
}