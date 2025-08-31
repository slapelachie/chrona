'use client';

import { Card, Row, Col } from 'react-bootstrap';
import { Clock, DollarSign, Calendar, TrendingUp } from 'lucide-react';
import { PayPeriodGroup } from '@/types';

interface ShiftSummaryCardsProps {
  payPeriods: PayPeriodGroup[];
  loading?: boolean;
  className?: string;
}

export default function ShiftSummaryCards({ 
  payPeriods, 
  loading = false,
  className = '' 
}: ShiftSummaryCardsProps) {
  
  const calculateSummary = () => {
    const totalHours = payPeriods.reduce((sum, period) => sum + period.summary.totalHours, 0);
    const totalPay = payPeriods.reduce((sum, period) => sum + period.summary.totalPay, 0);
    const totalShifts = payPeriods.reduce((sum, period) => sum + period.summary.shiftCount, 0);

    // Current week calculation
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    let currentWeekHours = 0;
    let currentWeekPay = 0;
    let currentWeekShifts = 0;

    payPeriods.forEach(period => {
      period.shifts.forEach(shift => {
        const shiftDate = new Date(shift.startTime);
        if (shiftDate >= startOfWeek && shiftDate <= endOfWeek) {
          const regular = typeof shift.regularHours === 'number' ? shift.regularHours : (shift.regularHours?.toNumber() || 0);
          const overtime = typeof shift.overtimeHours === 'number' ? shift.overtimeHours : (shift.overtimeHours?.toNumber() || 0);
          const penalty = typeof shift.penaltyHours === 'number' ? shift.penaltyHours : (shift.penaltyHours?.toNumber() || 0);
          const pay = typeof shift.grossPay === 'number' ? shift.grossPay : (shift.grossPay?.toNumber() || 0);
          
          const shiftHours = regular + overtime + penalty;
          currentWeekHours += shiftHours;
          currentWeekPay += pay;
          currentWeekShifts += 1;
        }
      });
    });

    // Calculate average per week (last 4 weeks)
    const fourWeeksAgo = new Date(today);
    fourWeeksAgo.setDate(today.getDate() - 28);
    
    let recentWeeklyHours = 0;
    let recentWeeklyPay = 0;
    let weeksWithShifts = 0;

    for (let i = 0; i < 4; i++) {
      const weekStart = new Date(fourWeeksAgo);
      weekStart.setDate(fourWeeksAgo.getDate() + (i * 7));
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      let weekHours = 0;
      let weekPay = 0;
      let hasShifts = false;

      payPeriods.forEach(period => {
        period.shifts.forEach(shift => {
          const shiftDate = new Date(shift.startTime);
          if (shiftDate >= weekStart && shiftDate <= weekEnd) {
            hasShifts = true;
            const regular = typeof shift.regularHours === 'number' ? shift.regularHours : (shift.regularHours?.toNumber() || 0);
            const overtime = typeof shift.overtimeHours === 'number' ? shift.overtimeHours : (shift.overtimeHours?.toNumber() || 0);
            const penalty = typeof shift.penaltyHours === 'number' ? shift.penaltyHours : (shift.penaltyHours?.toNumber() || 0);
            const pay = typeof shift.grossPay === 'number' ? shift.grossPay : (shift.grossPay?.toNumber() || 0);
            
            const shiftHours = regular + overtime + penalty;
            weekHours += shiftHours;
            weekPay += pay;
          }
        });
      });

      if (hasShifts) {
        recentWeeklyHours += weekHours;
        recentWeeklyPay += weekPay;
        weeksWithShifts++;
      }
    }

    const avgWeeklyHours = weeksWithShifts > 0 ? recentWeeklyHours / weeksWithShifts : 0;
    const avgWeeklyPay = weeksWithShifts > 0 ? recentWeeklyPay / weeksWithShifts : 0;

    return {
      totalHours: Math.round(totalHours * 10) / 10,
      totalPay: Math.round(totalPay * 100) / 100,
      totalShifts,
      currentWeekHours: Math.round(currentWeekHours * 10) / 10,
      currentWeekPay: Math.round(currentWeekPay * 100) / 100,
      currentWeekShifts,
      avgWeeklyHours: Math.round(avgWeeklyHours * 10) / 10,
      avgWeeklyPay: Math.round(avgWeeklyPay * 100) / 100
    };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const summary = calculateSummary();

  if (loading) {
    return (
      <div className={className}>
        <Row className="g-3">
          {[1, 2, 3, 4].map((i) => (
            <Col key={i} sm={6} lg={3}>
              <Card className="h-100 border-0 shadow-sm">
                <Card.Body className="text-center p-3">
                  <div className="placeholder-glow">
                    <div className="placeholder rounded-circle bg-light mx-auto mb-2" style={{ width: '32px', height: '32px' }}></div>
                    <div className="placeholder bg-secondary w-75 mx-auto mb-1"></div>
                    <div className="placeholder bg-secondary w-50 mx-auto"></div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    );
  }

  return (
    <div className={className}>
      <Row className="g-3">
        {/* This Week */}
        <Col sm={6} lg={3}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Body className="text-center p-3">
              <div className="d-flex justify-content-center mb-2">
                <div className="rounded-circle bg-primary bg-opacity-10 p-2">
                  <Calendar size={16} className="text-primary" />
                </div>
              </div>
              <div className="fw-bold text-dark">{summary.currentWeekHours}h</div>
              <div className="small text-muted mb-1">This Week</div>
              <div className="small text-success fw-medium">
                {formatCurrency(summary.currentWeekPay)}
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Total Hours */}
        <Col sm={6} lg={3}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Body className="text-center p-3">
              <div className="d-flex justify-content-center mb-2">
                <div className="rounded-circle bg-info bg-opacity-10 p-2">
                  <Clock size={16} className="text-info" />
                </div>
              </div>
              <div className="fw-bold text-dark">{summary.totalHours}h</div>
              <div className="small text-muted mb-1">Total Hours</div>
              <div className="small text-muted">
                {summary.totalShifts} shift{summary.totalShifts !== 1 ? 's' : ''}
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Total Earnings */}
        <Col sm={6} lg={3}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Body className="text-center p-3">
              <div className="d-flex justify-content-center mb-2">
                <div className="rounded-circle bg-success bg-opacity-10 p-2">
                  <DollarSign size={16} className="text-success" />
                </div>
              </div>
              <div className="fw-bold text-dark">
                {formatCurrency(summary.totalPay)}
              </div>
              <div className="small text-muted mb-1">Total Earnings</div>
              <div className="small text-success">
                Across {payPeriods.length} period{payPeriods.length !== 1 ? 's' : ''}
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Weekly Average */}
        <Col sm={6} lg={3}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Body className="text-center p-3">
              <div className="d-flex justify-content-center mb-2">
                <div className="rounded-circle bg-warning bg-opacity-10 p-2">
                  <TrendingUp size={16} className="text-warning" />
                </div>
              </div>
              <div className="fw-bold text-dark">{summary.avgWeeklyHours}h</div>
              <div className="small text-muted mb-1">Weekly Average</div>
              <div className="small text-warning">
                {formatCurrency(summary.avgWeeklyPay)}/week
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}