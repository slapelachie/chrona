'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardHeader, CardBody } from '../ui'
import { Calendar, Clock, DollarSign } from 'lucide-react'
import './pay-period-progress.scss'

export const PayPeriodProgress: React.FC = () => {
  const [summary, setSummary] = useState<any | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/dashboard/summary', { cache: 'no-store' })
        const json = await res.json()
        if (!cancelled) setSummary(json.data)
      } catch (_) {
        if (!cancelled) setSummary(null)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const vm = useMemo(() => {
    const cp = summary?.currentPeriod
    if (!cp) return null
    const progress = cp.totalDays > 0 ? (cp.daysElapsed / cp.totalDays) * 100 : 0
    const daysRemaining = Math.max(0, (cp.totalDays ?? 0) - (cp.daysElapsed ?? 0))
    const start = new Date(cp.startDate)
    const end = new Date(cp.endDate)
    const hoursWorked = Number(cp.hoursWorked ?? '0')
    const hoursRostered = Number(cp.projections?.rosteredHours ?? '0')
    const earnedSoFar = Number(cp.grossPay ?? '0')
    const projectedTotal = Number(cp.projections?.grossPay ?? '0')
    return { progress, daysRemaining, start, end, hoursWorked, hoursRostered, earnedSoFar, projectedTotal }
  }, [summary])

  if (!vm) return null

  return (
    <div className="pay-period-progress">
      <h2 className="pay-period-progress__title">Current Pay Period</h2>
      
      <Card variant="elevated">
        <CardHeader>
          <div className="pay-period-progress__header">
            <div className="pay-period-progress__dates">
              <Calendar size={20} />
              <span>
                {vm.start.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}
                {' - '}
                {vm.end.toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <div className="pay-period-progress__remaining">
              <span className="text-aqua">{vm.daysRemaining} days remaining</span>
            </div>
          </div>
        </CardHeader>
        
        <CardBody>
          <div className="pay-period-progress__content">
            {/* Progress Bar */}
            <div className="progress-section">
              <div className="progress-section__header">
                <span className="progress-section__label">Period Progress</span>
                <span className="progress-section__value">{Math.round(vm.progress)}%</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-bar__fill" 
                  style={{ width: `${vm.progress}%` }}
                  role="progressbar"
                  aria-valuenow={vm.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Pay period ${Math.round(vm.progress)}% complete`}
                />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="pay-period-stats">
              <div className="pay-period-stat">
                <div className="pay-period-stat__icon">
                  <Clock size={18} />
                </div>
                <div className="pay-period-stat__content">
                  <span className="pay-period-stat__value text-mono">
                    {vm.hoursWorked.toFixed(1)}h/{vm.hoursRostered.toFixed(1)}h
                  </span>
                  <span className="pay-period-stat__label">worked/rostered</span>
                  <div className="mini-progress-bar" aria-hidden>
                    <div 
                      className="mini-progress-bar__fill"
                      style={{ width: `${vm.hoursRostered > 0 ? (vm.hoursWorked / vm.hoursRostered) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="pay-period-stat">
                <div className="pay-period-stat__icon">
                  <DollarSign size={18} />
                </div>
                <div className="pay-period-stat__content">
                  <span className="pay-period-stat__value text-mono">
                    ${vm.earnedSoFar.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="pay-period-stat__label">
                    Projected: ${vm.projectedTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </span>
                  <div className="mini-progress-bar">
                    <div 
                      className="mini-progress-bar__fill"
                      style={{ width: `${vm.projectedTotal > 0 ? (vm.earnedSoFar / vm.projectedTotal) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
