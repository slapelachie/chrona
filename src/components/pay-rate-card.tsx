"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu"
import { PayRate } from "@/types"
import { 
  MoreHorizontal, 
  Edit, 
  Copy, 
  Trash2, 
  Star, 
  Clock, 
  Calendar, 
  DollarSign,
  Sun,
  Moon,
  Trophy
} from "lucide-react"

interface PayRateCardProps {
  rate: PayRate
  onEdit: (rate: PayRate) => void
  onDelete: (rateId: string) => void
  onDuplicate: (rate: PayRate) => void
}

export function PayRateCard({ rate, onEdit, onDelete, onDuplicate }: PayRateCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const effectiveRate = parseFloat(rate.baseRate.toString()) * parseFloat(rate.multiplier.toString())
  
  const getRateTypeColor = (type: string) => {
    switch (type) {
      case 'BASE':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'OVERTIME':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      case 'PENALTY':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'ALLOWANCE':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const isExpired = rate.effectiveTo && new Date(rate.effectiveTo) < new Date()
  const isFuture = new Date(rate.effectiveFrom) > new Date()

  const handleDelete = async () => {
    if (isDeleting) return
    setIsDeleting(true)
    try {
      await onDelete(rate.id)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card className={`relative ${isExpired ? 'opacity-60' : ''}`}>
      {rate.isDefault && (
        <div className="absolute -top-2 -right-2 bg-yellow-500 text-white rounded-full p-1">
          <Star className="h-3 w-3 fill-current" />
        </div>
      )}
      
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate">{rate.name}</CardTitle>
            {rate.description && (
              <CardDescription className="mt-1 line-clamp-2">
                {rate.description}
              </CardDescription>
            )}
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 ml-2">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(rate)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(rate)}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <Badge className={getRateTypeColor(rate.rateType)}>
            {rate.rateType}
          </Badge>
          {rate.isDefault && (
            <Badge variant="outline" className="text-yellow-600">
              <Star className="mr-1 h-3 w-3" />
              Default
            </Badge>
          )}
          {isExpired && (
            <Badge variant="outline" className="text-red-600">
              Expired
            </Badge>
          )}
          {isFuture && (
            <Badge variant="outline" className="text-blue-600">
              Future
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Rate Information */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Base Rate</span>
            <span className="font-medium">
              ${parseFloat(rate.baseRate.toString()).toFixed(2)}/hr
            </span>
          </div>
          
          {parseFloat(rate.multiplier.toString()) !== 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Multiplier</span>
              <span className="font-medium">×{parseFloat(rate.multiplier.toString())}</span>
            </div>
          )}
          
          <div className="flex items-center justify-between border-t pt-2">
            <span className="text-sm font-medium flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Effective Rate
            </span>
            <span className="text-lg font-bold text-green-600">
              ${effectiveRate.toFixed(2)}/hr
            </span>
          </div>
        </div>

        {/* Conditions */}
        {(rate.applyWeekend || rate.applyPublicHoliday || rate.applyNight) && (
          <div className="border-t pt-3">
            <span className="text-xs font-medium text-muted-foreground mb-2 block">
              CONDITIONS
            </span>
            <div className="flex flex-wrap gap-2">
              {rate.applyWeekend && (
                <Badge variant="outline" className="text-xs">
                  <Sun className="mr-1 h-3 w-3" />
                  Weekends
                </Badge>
              )}
              {rate.applyPublicHoliday && (
                <Badge variant="outline" className="text-xs">
                  <Trophy className="mr-1 h-3 w-3" />
                  Holidays
                </Badge>
              )}
              {rate.applyNight && (
                <Badge variant="outline" className="text-xs">
                  <Moon className="mr-1 h-3 w-3" />
                  Night ({rate.nightStart}-{rate.nightEnd})
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Overtime Information */}
        {rate.rateType === 'OVERTIME' && rate.overtimeThreshold && (
          <div className="border-t pt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Overtime after</span>
              <span className="font-medium">
                {parseFloat(rate.overtimeThreshold.toString())} hrs
              </span>
            </div>
            {rate.overtimeMultiplier && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">OT Multiplier</span>
                <span className="font-medium">
                  ×{parseFloat(rate.overtimeMultiplier.toString())}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Effective Period */}
        <div className="border-t pt-3">
          <span className="text-xs font-medium text-muted-foreground mb-2 block">
            EFFECTIVE PERIOD
          </span>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span>From {formatDate(rate.effectiveFrom)}</span>
            </div>
            {rate.effectiveTo ? (
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span>Until {formatDate(rate.effectiveTo)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-600">
                <Clock className="h-3 w-3" />
                <span>Ongoing</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="border-t pt-3 flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onEdit(rate)}
            className="flex-1"
          >
            <Edit className="h-3 w-3 mr-1" />
            Edit
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onDuplicate(rate)}
            className="flex-1"
          >
            <Copy className="h-3 w-3 mr-1" />
            Copy
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}