'use client';

import { useState, useEffect } from 'react';
import { Card, ProgressBar, Badge } from 'react-bootstrap';
import { TrendingUp, DollarSign, Calendar } from 'lucide-react';

interface ForecastData {
  currentEarnings: number;
  projectedTotal: number;
  remainingEarnings: number;
  progressPercentage: number;
  averageDailyRate: number;
  remainingDays: number;
  confidence: 'high' | 'medium' | 'low';
  trends: {
    vsLastPeriod: number;
    trend: 'up' | 'down' | 'stable';
  };
}

export default function EarningsForecast() {
  const [forecastData, setForecastData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchForecastData();
  }, []);

  const fetchForecastData = async () => {
    try {
      setLoading(true);
      
      // TODO: Replace with actual API call
      // Simulate API response
      setTimeout(() => {
        const mockData: ForecastData = {
          currentEarnings: 847.50,
          projectedTotal: 1345.80,
          remainingEarnings: 498.30,
          progressPercentage: 63,
          averageDailyRate: 142.25,
          remainingDays: 3.5,
          confidence: 'high',
          trends: {
            vsLastPeriod: 85.40,
            trend: 'up'
          }
        };

        setForecastData(mockData);
        setLoading(false);
      }, 800);
    } catch (error) {
      console.error('Error fetching forecast data:', error);
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getConfidenceBadgeVariant = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'success';
      case 'medium': return 'warning';
      case 'low': return 'danger';
      default: return 'secondary';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp size={14} className="text-success" />;
      case 'down': return <TrendingUp size={14} className="text-danger" style={{ transform: 'rotate(180deg)' }} />;
      case 'stable': return <span className="text-muted">→</span>;
      default: return null;
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

  if (!forecastData) {
    return (
      <Card className="shadow-sm h-100">
        <Card.Body className="d-flex justify-content-center align-items-center text-muted">
          Unable to load earnings forecast
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm h-100">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="card-title mb-0 d-flex align-items-center">
            <DollarSign size={20} className="me-2 text-primary" />
            Earnings Forecast
          </h5>
          <Badge bg={getConfidenceBadgeVariant(forecastData.confidence)} className="text-capitalize">
            {forecastData.confidence}
          </Badge>
        </div>

        {/* Current Progress */}
        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-end mb-2">
            <div>
              <div className="h4 text-success mb-0">{formatCurrency(forecastData.currentEarnings)}</div>
              <small className="text-muted">Current earnings</small>
            </div>
            <div className="text-end">
              <div className="fw-bold text-primary">{formatCurrency(forecastData.projectedTotal)}</div>
              <small className="text-muted">Projected total</small>
            </div>
          </div>
          
          <ProgressBar 
            now={forecastData.progressPercentage} 
            variant="success"
            className="mb-2"
            style={{ height: '8px' }}
          />
          
          <div className="d-flex justify-content-between">
            <small className="text-muted">{forecastData.progressPercentage}% complete</small>
            <small className="text-muted">{formatCurrency(forecastData.remainingEarnings)} remaining</small>
          </div>
        </div>

        {/* Forecast Details */}
        <div className="row g-2 mb-3">
          <div className="col-6">
            <div className="text-center p-2 bg-light rounded">
              <div className="fw-bold text-primary">{formatCurrency(forecastData.averageDailyRate)}</div>
              <small className="text-muted">Avg daily rate</small>
            </div>
          </div>
          <div className="col-6">
            <div className="text-center p-2 bg-light rounded">
              <div className="fw-bold text-info d-flex align-items-center justify-content-center">
                <Calendar size={14} className="me-1" />
                {forecastData.remainingDays}d
              </div>
              <small className="text-muted">Days remaining</small>
            </div>
          </div>
        </div>

        {/* Trend Comparison */}
        <div className="d-flex justify-content-between align-items-center p-3 bg-light rounded">
          <div>
            <small className="text-muted">vs Last Period</small>
            <div className="d-flex align-items-center">
              {getTrendIcon(forecastData.trends.trend)}
              <span className={`ms-1 fw-bold ${
                forecastData.trends.trend === 'up' ? 'text-success' : 
                forecastData.trends.trend === 'down' ? 'text-danger' : 'text-muted'
              }`}>
                {forecastData.trends.trend === 'up' ? '+' : forecastData.trends.trend === 'down' ? '-' : ''}
                {formatCurrency(Math.abs(forecastData.trends.vsLastPeriod))}
              </span>
            </div>
          </div>
          
          <div className="text-end">
            <small className="text-muted">Confidence</small>
            <div className="d-flex align-items-center justify-content-end">
              <div className={`badge bg-${getConfidenceBadgeVariant(forecastData.confidence)} me-1`}>
                {forecastData.confidence === 'high' ? '●●●' : 
                 forecastData.confidence === 'medium' ? '●●○' : '●○○'}
              </div>
              <small className="text-capitalize">{forecastData.confidence}</small>
            </div>
          </div>
        </div>

        {/* Forecast Notes */}
        <div className="mt-3">
          <small className="text-muted">
            {forecastData.confidence === 'high' && "Based on consistent shift patterns and confirmed upcoming shifts."}
            {forecastData.confidence === 'medium' && "Forecast includes some unconfirmed shifts and may vary."}
            {forecastData.confidence === 'low' && "Limited data available. Forecast may be significantly different."}
          </small>
        </div>
      </Card.Body>
    </Card>
  );
}