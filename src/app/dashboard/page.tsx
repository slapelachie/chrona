'use client';

import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { CalendarPlus, Clock, DollarSign, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import EarningsForecast from '@/components/earnings-forecast';
import HoursSummary from '@/components/hours-summary';
import UpcomingShifts from '@/components/upcoming-shifts';

interface PayPeriodSummary {
  startDate: Date;
  endDate: Date;
  payDate: Date;
  hoursWorked: number;
  estimatedGross: number;
  estimatedNet: number;
  estimatedTax: number;
  estimatedSuper: number;
  shiftsRemaining: number;
  daysUntilPay: number;
  taxBreakdown: {
    incomeTax: number;
    medicareLevy: number;
    hecsRepayment: number;
  };
}

interface KeyMetrics {
  weeklyHoursTrend: number;
  averageHourlyEarnings: number;
  upcomingPenaltyShifts: number;
  verificationStatus: 'pending' | 'verified' | 'discrepancy';
}

export default function DashboardPage() {
  const [payPeriodSummary, setPayPeriodSummary] = useState<PayPeriodSummary | null>(null);
  const [keyMetrics, setKeyMetrics] = useState<KeyMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/dashboard');
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      
      const data = await response.json();
      
      // Convert date strings back to Date objects
      const payPeriod: PayPeriodSummary = {
        ...data.payPeriodSummary,
        startDate: new Date(data.payPeriodSummary.startDate),
        endDate: new Date(data.payPeriodSummary.endDate),
        payDate: data.payPeriodSummary.payDate ? new Date(data.payPeriodSummary.payDate) : new Date()
      };
      
      setPayPeriodSummary(payPeriod);
      setKeyMetrics(data.keyMetrics);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-AU', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <Container fluid className="py-4">
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4">
      {/* Page Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h1 className="h3 mb-1">Dashboard</h1>
              <p className="text-muted mb-0">
                Current pay period: {payPeriodSummary && formatDate(payPeriodSummary.startDate)} - {payPeriodSummary && formatDate(payPeriodSummary.endDate)}
              </p>
            </div>
            <Link href="/shifts" passHref legacyBehavior>
              <Button variant="primary" size="sm">
                <CalendarPlus size={16} className="me-1" />
                Add Shift
              </Button>
            </Link>
          </div>
        </Col>
      </Row>

      {/* Current Pay Period Summary */}
      {payPeriodSummary && (
        <Row className="mb-4">
          <Col lg={8}>
            <Card className="shadow-sm">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="card-title mb-0">Current Pay Period</h5>
                  <span className="badge bg-primary">
                    {payPeriodSummary.daysUntilPay} days until pay
                  </span>
                </div>
                
                <Row>
                  <Col sm={6} lg={3}>
                    <div className="d-flex align-items-center mb-3 mb-lg-0">
                      <div className="me-3">
                        <Clock className="text-primary" size={24} />
                      </div>
                      <div>
                        <div className="fw-bold">{payPeriodSummary.hoursWorked}h</div>
                        <small className="text-muted">Hours worked</small>
                      </div>
                    </div>
                  </Col>
                  
                  <Col sm={6} lg={3}>
                    <div className="d-flex align-items-center mb-3 mb-lg-0">
                      <div className="me-3">
                        <DollarSign className="text-success" size={24} />
                      </div>
                      <div>
                        <div className="fw-bold">{formatCurrency(payPeriodSummary.estimatedGross)}</div>
                        <small className="text-muted">Estimated gross</small>
                      </div>
                    </div>
                  </Col>
                  
                  <Col sm={6} lg={3}>
                    <div className="d-flex align-items-center mb-3 mb-sm-0">
                      <div className="me-3">
                        <TrendingUp className="text-info" size={24} />
                      </div>
                      <div>
                        <div className="fw-bold">{formatCurrency(payPeriodSummary.estimatedNet)}</div>
                        <small className="text-muted">Estimated net</small>
                      </div>
                    </div>
                  </Col>
                  
                  <Col sm={6} lg={3}>
                    <div className="d-flex align-items-center">
                      <div className="me-3">
                        <CalendarPlus className="text-warning" size={24} />
                      </div>
                      <div>
                        <div className="fw-bold">{payPeriodSummary.shiftsRemaining}</div>
                        <small className="text-muted">Shifts remaining</small>
                      </div>
                    </div>
                  </Col>
                </Row>
                
                {/* Tax and Super Breakdown */}
                <div className="mt-4 pt-3 border-top">
                  <h6 className="text-muted mb-3">Deductions Breakdown</h6>
                  <Row className="g-3">
                    <Col sm={6} md={3}>
                      <div className="text-center p-2 bg-light rounded">
                        <div className="fw-bold text-danger">{formatCurrency(payPeriodSummary.estimatedTax)}</div>
                        <small className="text-muted">Total Tax</small>
                      </div>
                    </Col>
                    <Col sm={6} md={3}>
                      <div className="text-center p-2 bg-light rounded">
                        <div className="fw-bold text-primary">{formatCurrency(payPeriodSummary.estimatedSuper)}</div>
                        <small className="text-muted">Superannuation</small>
                      </div>
                    </Col>
                    <Col sm={6} md={3}>
                      <div className="text-center p-2 bg-light rounded">
                        <div className="fw-bold text-info">{formatCurrency(payPeriodSummary.taxBreakdown.incomeTax)}</div>
                        <small className="text-muted">Income Tax</small>
                      </div>
                    </Col>
                    <Col sm={6} md={3}>
                      <div className="text-center p-2 bg-light rounded">
                        <div className="fw-bold text-secondary">{formatCurrency(payPeriodSummary.taxBreakdown.medicareLevy + payPeriodSummary.taxBreakdown.hecsRepayment)}</div>
                        <small className="text-muted">Medicare + HECS</small>
                      </div>
                    </Col>
                  </Row>
                </div>
              </Card.Body>
            </Card>
          </Col>
          
          <Col lg={4}>
            <Card className="shadow-sm h-100">
              <Card.Body className="d-flex flex-column">
                <h5 className="card-title mb-3">Quick Actions</h5>
                <div className="d-grid gap-2 flex-grow-1">
                  <Link href="/shifts" passHref legacyBehavior>
                    <Button variant="outline-primary" size="lg">
                      <CalendarPlus size={18} className="me-2" />
                      Add New Shift
                    </Button>
                  </Link>
                  <Link href="/shifts" passHref legacyBehavior>
                    <Button variant="outline-secondary">
                      View All Shifts
                    </Button>
                  </Link>
                  <Link href="/verification" passHref legacyBehavior>
                    <Button variant="outline-info">
                      Pay Verification
                    </Button>
                  </Link>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Key Metrics Cards */}
      {keyMetrics && (
        <Row className="mb-4">
          <Col sm={6} lg={3}>
            <Card className="shadow-sm">
              <Card.Body className="text-center">
                <div className="display-6 text-primary mb-2">
                  {keyMetrics.weeklyHoursTrend > 0 ? '+' : ''}{keyMetrics.weeklyHoursTrend}h
                </div>
                <div className="fw-bold mb-1">Weekly Hours Trend</div>
                <small className="text-muted">vs last period</small>
              </Card.Body>
            </Card>
          </Col>
          
          <Col sm={6} lg={3}>
            <Card className="shadow-sm">
              <Card.Body className="text-center">
                <div className="display-6 text-success mb-2">
                  {formatCurrency(keyMetrics.averageHourlyEarnings)}
                </div>
                <div className="fw-bold mb-1">Average Hourly</div>
                <small className="text-muted">including penalties</small>
              </Card.Body>
            </Card>
          </Col>
          
          <Col sm={6} lg={3}>
            <Card className="shadow-sm">
              <Card.Body className="text-center">
                <div className="display-6 text-warning mb-2">
                  {keyMetrics.upcomingPenaltyShifts}
                </div>
                <div className="fw-bold mb-1">Penalty Shifts</div>
                <small className="text-muted">this period</small>
              </Card.Body>
            </Card>
          </Col>
          
          <Col sm={6} lg={3}>
            <Card className="shadow-sm">
              <Card.Body className="text-center">
                <div className={`display-6 mb-2 ${
                  keyMetrics.verificationStatus === 'verified' ? 'text-success' : 
                  keyMetrics.verificationStatus === 'discrepancy' ? 'text-danger' : 'text-warning'
                }`}>
                  {keyMetrics.verificationStatus === 'verified' ? '✓' : 
                   keyMetrics.verificationStatus === 'discrepancy' ? '!' : '?'}
                </div>
                <div className="fw-bold mb-1">Verification</div>
                <small className="text-muted text-capitalize">{keyMetrics.verificationStatus}</small>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Components Section */}
      <Row>
        <Col lg={4}>
          <div className="mb-4">
            <EarningsForecast />
          </div>
        </Col>
        
        <Col lg={4}>
          <div className="mb-4">
            <HoursSummary />
          </div>
        </Col>
        
        <Col lg={4}>
          <div className="mb-4">
            <UpcomingShifts />
          </div>
        </Col>
      </Row>

      {/* Mobile-specific quick actions at bottom */}
      <div className="d-lg-none fixed-bottom bg-body border-top p-3">
        <Row>
          <Col>
            <Link href="/shifts" passHref legacyBehavior>
              <Button variant="primary" className="w-100" size="lg">
                <CalendarPlus size={20} className="me-2" />
                Add Shift
              </Button>
            </Link>
          </Col>
        </Row>
      </div>
    </Container>
  );
}