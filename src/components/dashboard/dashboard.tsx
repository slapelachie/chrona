'use client'

import React from 'react'
import { StatsCards } from './stats-cards'
import { PayPeriodProgress } from './pay-period-progress'
import { UpcomingShifts } from './upcoming-shifts'
import { QuickActions } from './quick-actions'
import { RecentActivity } from './recent-activity'
import './dashboard.scss'

export const Dashboard: React.FC = () => {
  return (
    <div className="dashboard">
      <div className="dashboard__section">
        <StatsCards />
      </div>
      
      <div className="dashboard__section">
        <PayPeriodProgress />
      </div>
      
      <div className="dashboard__section">
        <QuickActions />
      </div>
      
      <div className="dashboard__section">
        <UpcomingShifts />
      </div>
      
      <div className="dashboard__section">
        <RecentActivity />
      </div>
    </div>
  )
}