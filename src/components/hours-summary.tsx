'use client';

import { useState, useEffect } from 'react';
import { Card, ProgressBar } from 'react-bootstrap';
import { Clock, Zap, Moon, Calendar } from 'lucide-react';

interface HoursBreakdown {
  regular: {
    hours: number;
    percentage: number;
    color: string;
  };
  overtime: {
    hours: number;
    percentage: number;
    color: string;
  };
  penalty: {
    hours: number;
    percentage: number;
    color: string;
  };
  total: number;
}

interface WeeklyComparison {
  currentWeek: number;
  previousWeek: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

export default function HoursSummary() {
  const [hoursData, setHoursData] = useState<HoursBreakdown | null>(null);
  const [weeklyComparison, setWeeklyComparison] = useState<WeeklyComparison | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHoursData();
  }, []);

  const fetchHoursData = async () => {
    try {
      setLoading(true);
      
      // TODO: Replace with actual API call
      // Simulate API response
      setTimeout(() => {
        const mockHoursData: HoursBreakdown = {
          regular: {
            hours: 28.5,
            percentage: 72,
            color: 'primary'
          },
          overtime: {
            hours: 6.5,
            percentage: 16,
            color: 'warning'
          },
          penalty: {
            hours: 4.75,
            percentage: 12,
            color: 'info'
          },
          total: 39.75
        };

        const mockWeeklyComparison: WeeklyComparison = {
          currentWeek: 19.25,
          previousWeek: 16.5,
          change: 2.75,
          trend: 'up'
        };

        setHoursData(mockHoursData);
        setWeeklyComparison(mockWeeklyComparison);
        setLoading(false);
      }, 600);
    } catch (error) {
      console.error('Error fetching hours data:', error);
      setLoading(false);
    }
  };

  const formatHours = (hours: number) => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    
    if (minutes === 0) {
      return `${wholeHours}h`;
    } else if (wholeHours === 0) {
      return `${minutes}m`;
    } else {
      return `${wholeHours}h ${minutes}m`;
    }
  };

  const getIconForType = (type: 'regular' | 'overtime' | 'penalty') => {
    switch (type) {
      case 'regular':
        return <Clock size={16} />;
      case 'overtime':
        return <Zap size={16} />;
      case 'penalty':
        return <Moon size={16} />;
      default:
        return <Clock size={16} />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <span className="text-success">↗</span>;
      case 'down':
        return <span className="text-danger">↘</span>;
      case 'stable':
        return <span className="text-muted">→</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Card className="shadow-sm h-100">
        <Card.Body className="d-flex justify-content-center align-items-center" style={{ minHeight: '250px' }}>
          <div className="spinner-border spinner-border-sm text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </Card.Body>
      </Card>
    );
  }

  if (!hoursData || !weeklyComparison) {
    return (
      <Card className="shadow-sm h-100">
        <Card.Body className="d-flex justify-content-center align-items-center text-muted">
          Unable to load hours summary
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm h-100">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="card-title mb-0 d-flex align-items-center">
            <Clock size={20} className="me-2 text-primary" />
            Hours Breakdown
          </h5>
          <div className="text-end">
            <div className="fw-bold text-primary">{formatHours(hoursData.total)}</div>
            <small className="text-muted">Total hours</small>
          </div>
        </div>

        {/* Hours Breakdown with Progress Bars */}
        <div className="mb-4">
          {/* Regular Hours */}
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div className="d-flex align-items-center">
              <span className="text-primary me-2">{getIconForType('regular')}</span>
              <span>Regular</span>
            </div>
            <div className="text-end">
              <span className="fw-bold">{formatHours(hoursData.regular.hours)}</span>
              <small className="text-muted ms-1">({hoursData.regular.percentage}%)</small>
            </div>
          </div>
          <ProgressBar 
            variant={hoursData.regular.color} 
            now={hoursData.regular.percentage} 
            className="mb-3"
            style={{ height: '6px' }}
          />

          {/* Overtime Hours */}
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div className="d-flex align-items-center">
              <span className="text-warning me-2">{getIconForType('overtime')}</span>
              <span>Overtime</span>
            </div>
            <div className="text-end">
              <span className="fw-bold">{formatHours(hoursData.overtime.hours)}</span>
              <small className="text-muted ms-1">({hoursData.overtime.percentage}%)</small>
            </div>
          </div>
          <ProgressBar 
            variant={hoursData.overtime.color} 
            now={hoursData.overtime.percentage} 
            className="mb-3"
            style={{ height: '6px' }}
          />

          {/* Penalty Hours */}
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div className="d-flex align-items-center">
              <span className="text-info me-2">{getIconForType('penalty')}</span>
              <span>Penalty</span>
            </div>
            <div className="text-end">
              <span className="fw-bold">{formatHours(hoursData.penalty.hours)}</span>
              <small className="text-muted ms-1">({hoursData.penalty.percentage}%)</small>
            </div>
          </div>
          <ProgressBar 
            variant={hoursData.penalty.color} 
            now={hoursData.penalty.percentage} 
            className="mb-3"
            style={{ height: '6px' }}
          />
        </div>

        {/* Weekly Comparison */}
        <div className="p-3 bg-light rounded">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div className="d-flex align-items-center">
              <Calendar size={16} className="me-2 text-muted" />
              <small className="text-muted">This Week vs Last Week</small>
            </div>
            {getTrendIcon(weeklyComparison.trend)}
          </div>
          
          <div className="d-flex justify-content-between">
            <div>
              <div className="fw-bold text-primary">{formatHours(weeklyComparison.currentWeek)}</div>
              <small className="text-muted">Current</small>
            </div>
            <div className="text-center">
              <div className={`fw-bold ${
                weeklyComparison.change > 0 ? 'text-success' : 
                weeklyComparison.change < 0 ? 'text-danger' : 'text-muted'
              }`}>
                {weeklyComparison.change > 0 ? '+' : ''}
                {formatHours(Math.abs(weeklyComparison.change))}
              </div>
              <small className="text-muted">Change</small>
            </div>
            <div className="text-end">
              <div className="fw-bold text-secondary">{formatHours(weeklyComparison.previousWeek)}</div>
              <small className="text-muted">Previous</small>
            </div>
          </div>
        </div>

        {/* Additional Insights */}
        <div className="mt-3">
          <small className="text-muted">
            {hoursData.overtime.percentage > 20 && "High overtime this period. "}
            {hoursData.penalty.percentage > 15 && "Good penalty rate coverage. "}
            {weeklyComparison.trend === 'up' && weeklyComparison.change > 5 && "Significant increase from last week."}
            {weeklyComparison.trend === 'stable' && "Consistent with previous week."}
          </small>
        </div>
      </Card.Body>
    </Card>
  );
}