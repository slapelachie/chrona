"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PayRate, RateType } from "@/types"
import { Loader2, Plus, ArrowLeft, Search, Filter, Calendar } from "lucide-react"
import { PayRateCard } from "@/components/pay-rate-card"
import { PayRateForm } from "@/components/pay-rate-form"

export default function PayRatesPage() {
  const router = useRouter()
  const [payRates, setPayRates] = useState<PayRate[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRate, setEditingRate] = useState<PayRate | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState<RateType | "ALL">("ALL")
  const [sortBy, setSortBy] = useState<"name" | "effectiveFrom" | "baseRate">("name")

  useEffect(() => {
    fetchPayRates()
  }, [])

  const fetchPayRates = async () => {
    try {
      const response = await fetch('/api/pay-rates')
      if (response.ok) {
        const data = await response.json()
        setPayRates(data)
      } else {
        console.error('Failed to fetch pay rates')
      }
    } catch (error) {
      console.error('Failed to fetch pay rates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRate = () => {
    setEditingRate(null)
    setShowForm(true)
  }

  const handleEditRate = (rate: PayRate) => {
    setEditingRate(rate)
    setShowForm(true)
  }

  const handleDeleteRate = async (rateId: string) => {
    if (!confirm('Are you sure you want to delete this pay rate?')) {
      return
    }

    try {
      const response = await fetch(`/api/pay-rates/${rateId}`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        await fetchPayRates()
      } else {
        console.error('Failed to delete pay rate')
      }
    } catch (error) {
      console.error('Failed to delete pay rate:', error)
    }
  }

  const handleDuplicateRate = (rate: PayRate) => {
    const duplicatedRate = {
      ...rate,
      name: `${rate.name} (Copy)`,
      isDefault: false,
      effectiveFrom: new Date(),
      effectiveTo: null,
    }
    // Remove the id to indicate this is a new rate
    delete (duplicatedRate as Partial<PayRate>).id
    setEditingRate(duplicatedRate as PayRate)
    setShowForm(true)
  }

  const handleFormSubmit = async () => {
    await fetchPayRates()
    setShowForm(false)
    setEditingRate(null)
  }

  const handleFormCancel = () => {
    setShowForm(false)
    setEditingRate(null)
  }

  // Filter and sort pay rates
  const filteredAndSortedRates = payRates
    .filter(rate => {
      const matchesSearch = rate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           rate.description?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = filterType === "ALL" || rate.rateType === filterType
      return matchesSearch && matchesType
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name)
        case "effectiveFrom":
          return new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime()
        case "baseRate":
          return parseFloat(b.baseRate.toString()) - parseFloat(a.baseRate.toString())
        default:
          return 0
      }
    })

  // Group rates by type for better organization
  const groupedRates = filteredAndSortedRates.reduce((acc, rate) => {
    if (!acc[rate.rateType]) {
      acc[rate.rateType] = []
    }
    acc[rate.rateType].push(rate)
    return acc
  }, {} as Record<RateType, PayRate[]>)

  const getRateTypeLabel = (type: RateType) => {
    switch (type) {
      case 'BASE': return 'Base Rates'
      case 'OVERTIME': return 'Overtime Rates'
      case 'PENALTY': return 'Penalty Rates'
      case 'ALLOWANCE': return 'Allowances'
      default: return type
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (showForm) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleFormCancel}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">
            {editingRate ? 'Edit Pay Rate' : 'Create New Pay Rate'}
          </h1>
        </div>
        
        <PayRateForm
          initialData={editingRate}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
        />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => router.push('/settings')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Pay Rates</h1>
            <p className="text-muted-foreground">
              Manage your hourly rates and penalty rates
            </p>
          </div>
        </div>
        <Button onClick={handleCreateRate}>
          <Plus className="h-4 w-4 mr-2" />
          New Rate
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{payRates.length}</div>
            <p className="text-xs text-muted-foreground">Total Rates</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {payRates.filter(r => r.rateType === 'BASE').length}
            </div>
            <p className="text-xs text-muted-foreground">Base Rates</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {payRates.filter(r => r.rateType === 'PENALTY').length}
            </div>
            <p className="text-xs text-muted-foreground">Penalty Rates</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {payRates.filter(r => r.isDefault).length}
            </div>
            <p className="text-xs text-muted-foreground">Default Rates</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search rates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Rate Type</label>
              <Select value={filterType} onValueChange={(value: RateType | "ALL") => setFilterType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  <SelectItem value="BASE">Base Rates</SelectItem>
                  <SelectItem value="OVERTIME">Overtime</SelectItem>
                  <SelectItem value="PENALTY">Penalty Rates</SelectItem>
                  <SelectItem value="ALLOWANCE">Allowances</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Sort By</label>
              <Select value={sortBy} onValueChange={(value: "name" | "effectiveFrom" | "baseRate") => setSortBy(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="effectiveFrom">Effective Date</SelectItem>
                  <SelectItem value="baseRate">Rate Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pay Rates List */}
      {filteredAndSortedRates.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No pay rates found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || filterType !== "ALL" 
                ? "Try adjusting your filters"
                : "Get started by creating your first pay rate"
              }
            </p>
            {!searchTerm && filterType === "ALL" && (
              <Button onClick={handleCreateRate}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Rate
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {filterType === "ALL" ? (
            // Group by rate type
            Object.entries(groupedRates).map(([rateType, rates]) => (
              <div key={rateType}>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  {getRateTypeLabel(rateType as RateType)}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({rates.length})
                  </span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rates.map((rate) => (
                    <PayRateCard
                      key={rate.id}
                      rate={rate}
                      onEdit={handleEditRate}
                      onDelete={handleDeleteRate}
                      onDuplicate={handleDuplicateRate}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            // Show filtered results in a grid
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAndSortedRates.map((rate) => (
                <PayRateCard
                  key={rate.id}
                  rate={rate}
                  onEdit={handleEditRate}
                  onDelete={handleDeleteRate}
                  onDuplicate={handleDuplicateRate}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}