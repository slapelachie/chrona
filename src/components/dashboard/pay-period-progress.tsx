'use client'

import React from 'react'
import { Card, CardHeader, CardBody } from '../ui'
import { Calendar, Clock, DollarSign } from 'lucide-react'
import './pay-period-progress.scss'

export const PayPeriodProgress: React.FC = () => {
  // Mock data - in real app, this would come from API/database
  const payPeriod = {
    startDate: '2024-09-02',
    endDate: '2024-09-15',
    currentDate: '2024-09-10',
    daysWorked: 6,
    totalDays: 14,
    hoursWorked: 48.5,
    expectedHours: 80,
    earnedSoFar: 1234.75,
    projectedTotal: 2048.00
  }

  const progress = (payPeriod.daysWorked / payPeriod.totalDays) * 100
  const hoursProgress = (payPeriod.hoursWorked / payPeriod.expectedHours) * 100
  const daysRemaining = payPeriod.totalDays - payPeriod.daysWorked

  return (
    <div className="pay-period-progress">
      <h2 className="pay-period-progress__title">Current Pay Period</h2>
      
      <Card variant="elevated">
        <CardHeader>
          <div className="pay-period-progress__header">
            <div className="pay-period-progress__dates">
              <Calendar size={20} />
              <span>Sep 2 - Sep 15, 2024</span>
            </div>
            <div className="pay-period-progress__remaining">
              <span className="text-aqua">{daysRemaining} days remaining</span>
            </div>
          </div>
        </CardHeader>
        
        <CardBody>
          <div className="pay-period-progress__content">
            {/* Progress Bar */}
            <div className="progress-section">
              <div className="progress-section__header">
                <span className="progress-section__label">Period Progress</span>
                <span className="progress-section__value">{Math.round(progress)}%</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-bar__fill" 
                  style={{ width: `${progress}%` }}
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Pay period ${Math.round(progress)}% complete`}
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
                    {payPeriod.hoursWorked}h
                  </span>
                  <span className="pay-period-stat__label">
                    of {payPeriod.expectedHours}h expected
                  </span>
                  <div className="mini-progress-bar">
                    <div 
                      className="mini-progress-bar__fill"
                      style={{ width: `${Math.min(hoursProgress, 100)}%` }}
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
                    ${payPeriod.earnedSoFar.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="pay-period-stat__label">
                    Projected: ${payPeriod.projectedTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </span>
                  <div className="mini-progress-bar">
                    <div 
                      className="mini-progress-bar__fill"
                      style={{ width: `${(payPeriod.earnedSoFar / payPeriod.projectedTotal) * 100}%` }}
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