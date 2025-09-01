'use client';

import { useState, useEffect } from 'react';
import { Card, Row, Col } from 'react-bootstrap';
import { DollarSign, Calendar, TrendingUp } from 'lucide-react';

interface SummaryData {
  currentPeriod: {
    id: string;
    startDate: string;
    endDate: string;
    name: string;
    summary: {
      totalHours: number;
      totalPay: number;
      shiftCount: number;
    };
  };
  allTimeSummary: {
    totalHours: number;
    totalPay: number;
    shiftCount: number;
  };
  averagePeriod: {
    totalHours: number;
    totalPay: number;
    shiftCount: number;
  };
}

interface ShiftSummaryCardsProps {
  loading?: boolean;
  className?: string;
}

export default function ShiftSummaryCards({ 
  loading = false,
  className = '' 
}: ShiftSummaryCardsProps) {
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    fetchSummaryData();
  }, []);

  const fetchSummaryData = async () => {
    try {
      setSummaryLoading(true);
      const response = await fetch('/api/shifts/summary');
      if (!response.ok) {
        throw new Error('Failed to fetch summary data');
      }
      const data = await response.json();
      setSummaryData(data);
    } catch (error) {
      console.error('Error fetching summary data:', error);
    } finally {
      setSummaryLoading(false);
    }
  };

  const isLoading = loading || summaryLoading;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  if (isLoading || !summaryData) {
    return (
      <div className={className}>
        <Row className="g-3">
          {[1, 2, 3, 4].map((i) => (
            <Col key={i} sm={6} lg={3}>
              <Card className="h-100 border-0 shadow-sm">
                <Card.Body className="text-center p-3">
                  <div className="placeholder-glow">
                    <div className="placeholder rounded-circle mx-auto mb-2" style={{ width: '32px', height: '32px', backgroundColor: 'var(--chrona-bg-secondary)' }}></div>
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
        {/* Current Period Earnings */}
        <Col sm={6} lg={3}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Body className="text-center p-3">
              <div className="d-flex justify-content-center mb-2">
                <div className="rounded-circle bg-success bg-opacity-10 p-2">
                  <DollarSign size={16} className="text-success" />
                </div>
              </div>
              <div className="fw-bold text-success">
                {formatCurrency(summaryData.currentPeriod.summary.totalPay)}
              </div>
              <div className="small text-muted mb-1">Current Period</div>
              <div className="small text-muted">
                {Math.round(summaryData.currentPeriod.summary.totalHours * 10) / 10}h worked
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Total Shifts */}
        <Col sm={6} lg={3}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Body className="text-center p-3">
              <div className="d-flex justify-content-center mb-2">
                <div className="rounded-circle bg-info bg-opacity-10 p-2">
                  <Calendar size={16} className="text-info" />
                </div>
              </div>
              <div className="fw-bold">{summaryData.allTimeSummary.shiftCount}</div>
              <div className="small text-muted mb-1">Total Shifts</div>
              <div className="small text-muted">
                {Math.round(summaryData.allTimeSummary.totalHours * 10) / 10}h total
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* All Time Earnings */}
        <Col sm={6} lg={3}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Body className="text-center p-3">
              <div className="d-flex justify-content-center mb-2">
                <div className="rounded-circle bg-primary bg-opacity-10 p-2">
                  <DollarSign size={16} className="text-primary" />
                </div>
              </div>
              <div className="fw-bold text-primary">
                {formatCurrency(summaryData.allTimeSummary.totalPay)}
              </div>
              <div className="small text-muted mb-1">All Time Earnings</div>
              <div className="small text-muted">
                Since you started
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Period Average */}
        <Col sm={6} lg={3}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Body className="text-center p-3">
              <div className="d-flex justify-content-center mb-2">
                <div className="rounded-circle bg-warning bg-opacity-10 p-2">
                  <TrendingUp size={16} className="text-warning" />
                </div>
              </div>
              <div className="fw-bold text-warning">
                {formatCurrency(summaryData.averagePeriod.totalPay)}
              </div>
              <div className="small text-muted mb-1">Period Average</div>
              <div className="small text-muted">
                {Math.round(summaryData.averagePeriod.totalHours * 10) / 10}h per period
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}