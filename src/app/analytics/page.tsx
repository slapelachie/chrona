'use client';

import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Nav } from 'react-bootstrap';
import { BarChart3, TrendingUp, Clock, DollarSign, Calendar } from 'lucide-react';

interface AnalyticsData {
  weeklyTrends: {
    week: string;
    hours: number;
    earnings: number;
    shifts: number;
  }[];
  monthlyTotals: {
    month: string;
    totalHours: number;
    totalEarnings: number;
    averageHourlyRate: number;
  }[];
  payTypeBreakdown: {
    regular: { hours: number; earnings: number; percentage: number };
    overtime: { hours: number; earnings: number; percentage: number };
    penalty: { hours: number; earnings: number; percentage: number };
  };
  yearToDate: {
    totalEarnings: number;
    totalHours: number;
    totalTax: number;
    totalSuper: number;
    shiftsWorked: number;
    averageWeeklyHours: number;
    averageHourlyRate: number;
  };
}

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/analytics');
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      
      const data = await response.json();
      setAnalyticsData(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
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

  if (!analyticsData) {
    return (
      <Container fluid className="py-4">
        <Card>
          <Card.Body className="text-center">
            <h5>No Analytics Data Available</h5>
            <p className="text-muted">Start tracking shifts to see your earnings analytics.</p>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4">
      {/* Page Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex align-items-center mb-3">
            <BarChart3 size={32} className="text-primary me-3" />
            <div>
              <h1 className="h3 mb-0">Analytics</h1>
              <p className="text-muted mb-0">Earnings and hours analysis</p>
            </div>
          </div>
        </Col>
      </Row>

      {/* Navigation Tabs */}
      <Row className="mb-4">
        <Col>
          <Nav variant="tabs" activeKey={activeTab} onSelect={(k) => setActiveTab(k || 'overview')}>
            <Nav.Item>
              <Nav.Link eventKey="overview">Overview</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="trends">Trends</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="breakdown">Breakdown</Nav.Link>
            </Nav.Item>
          </Nav>
        </Col>
      </Row>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Year to Date Summary */}
          <Row className="mb-4">
            <Col>
              <Card>
                <Card.Header>
                  <h5 className="mb-0">Year to Date Summary</h5>
                </Card.Header>
                <Card.Body>
                  <Row>
                    <Col sm={6} lg={3}>
                      <div className="text-center p-3">
                        <DollarSign size={32} className="text-success mb-2" />
                        <div className="h4 fw-bold">{formatCurrency(analyticsData.yearToDate.totalEarnings)}</div>
                        <small className="text-muted">Total Earnings</small>
                      </div>
                    </Col>
                    <Col sm={6} lg={3}>
                      <div className="text-center p-3">
                        <Clock size={32} className="text-primary mb-2" />
                        <div className="h4 fw-bold">{analyticsData.yearToDate.totalHours}h</div>
                        <small className="text-muted">Total Hours</small>
                      </div>
                    </Col>
                    <Col sm={6} lg={3}>
                      <div className="text-center p-3">
                        <Calendar size={32} className="text-info mb-2" />
                        <div className="h4 fw-bold">{analyticsData.yearToDate.shiftsWorked}</div>
                        <small className="text-muted">Shifts Worked</small>
                      </div>
                    </Col>
                    <Col sm={6} lg={3}>
                      <div className="text-center p-3">
                        <TrendingUp size={32} className="text-warning mb-2" />
                        <div className="h4 fw-bold">{formatCurrency(analyticsData.yearToDate.averageHourlyRate)}</div>
                        <small className="text-muted">Average Hourly Rate</small>
                      </div>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Key Metrics */}
          <Row className="mb-4">
            <Col lg={6}>
              <Card className="h-100">
                <Card.Header>
                  <h6 className="mb-0">Financial Overview</h6>
                </Card.Header>
                <Card.Body>
                  <Row>
                    <Col xs={6}>
                      <div className="text-center p-2">
                        <div className="fw-bold text-success">{formatCurrency(analyticsData.yearToDate.totalEarnings)}</div>
                        <small className="text-muted">Gross Earnings</small>
                      </div>
                    </Col>
                    <Col xs={6}>
                      <div className="text-center p-2">
                        <div className="fw-bold text-danger">{formatCurrency(analyticsData.yearToDate.totalTax)}</div>
                        <small className="text-muted">Total Tax</small>
                      </div>
                    </Col>
                    <Col xs={6}>
                      <div className="text-center p-2">
                        <div className="fw-bold text-primary">{formatCurrency(analyticsData.yearToDate.totalSuper)}</div>
                        <small className="text-muted">Superannuation</small>
                      </div>
                    </Col>
                    <Col xs={6}>
                      <div className="text-center p-2">
                        <div className="fw-bold text-info">{formatCurrency(analyticsData.yearToDate.totalEarnings - analyticsData.yearToDate.totalTax)}</div>
                        <small className="text-muted">Net Income</small>
                      </div>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </Col>
            <Col lg={6}>
              <Card className="h-100">
                <Card.Header>
                  <h6 className="mb-0">Work Patterns</h6>
                </Card.Header>
                <Card.Body>
                  <Row>
                    <Col xs={6}>
                      <div className="text-center p-2">
                        <div className="fw-bold text-primary">{analyticsData.yearToDate.averageWeeklyHours}h</div>
                        <small className="text-muted">Avg Weekly Hours</small>
                      </div>
                    </Col>
                    <Col xs={6}>
                      <div className="text-center p-2">
                        <div className="fw-bold text-success">{(analyticsData.yearToDate.shiftsWorked / 52).toFixed(1)}</div>
                        <small className="text-muted">Avg Weekly Shifts</small>
                      </div>
                    </Col>
                    <Col xs={6}>
                      <div className="text-center p-2">
                        <div className="fw-bold text-info">{(analyticsData.yearToDate.totalHours / analyticsData.yearToDate.shiftsWorked).toFixed(1)}h</div>
                        <small className="text-muted">Avg Shift Length</small>
                      </div>
                    </Col>
                    <Col xs={6}>
                      <div className="text-center p-2">
                        <div className="fw-bold text-warning">{((analyticsData.payTypeBreakdown.overtime.hours + analyticsData.payTypeBreakdown.penalty.hours) / analyticsData.yearToDate.totalHours * 100).toFixed(1)}%</div>
                        <small className="text-muted">Premium Hours</small>
                      </div>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* Trends Tab */}
      {activeTab === 'trends' && (
        <Row>
          <Col lg={6}>
            <Card className="mb-4">
              <Card.Header>
                <h6 className="mb-0">Weekly Trends</h6>
              </Card.Header>
              <Card.Body>
                {analyticsData.weeklyTrends.map((week, index) => (
                  <div key={index} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                    <div>
                      <div className="fw-bold">{week.week}</div>
                      <small className="text-muted">{week.shifts} shifts</small>
                    </div>
                    <div className="text-end">
                      <div className="fw-bold">{formatCurrency(week.earnings)}</div>
                      <small className="text-muted">{week.hours}h</small>
                    </div>
                  </div>
                ))}
              </Card.Body>
            </Card>
          </Col>
          <Col lg={6}>
            <Card className="mb-4">
              <Card.Header>
                <h6 className="mb-0">Monthly Performance</h6>
              </Card.Header>
              <Card.Body>
                {analyticsData.monthlyTotals.map((month, index) => (
                  <div key={index} className="d-flex justify-content-between align-items-center py-3 border-bottom">
                    <div>
                      <div className="fw-bold">{month.month}</div>
                      <small className="text-muted">{month.totalHours}h total</small>
                    </div>
                    <div className="text-end">
                      <div className="fw-bold">{formatCurrency(month.totalEarnings)}</div>
                      <small className="text-muted">{formatCurrency(month.averageHourlyRate)}/hr avg</small>
                    </div>
                  </div>
                ))}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Breakdown Tab */}
      {activeTab === 'breakdown' && (
        <Row>
          <Col>
            <Card>
              <Card.Header>
                <h6 className="mb-0">Pay Type Breakdown</h6>
              </Card.Header>
              <Card.Body>
                <Row>
                  <Col lg={4}>
                    <div className="text-center p-4 border rounded mb-3">
                      <div className="h4 fw-bold text-primary">{analyticsData.payTypeBreakdown.regular.hours}h</div>
                      <div className="h5 fw-bold">{formatCurrency(analyticsData.payTypeBreakdown.regular.earnings)}</div>
                      <div className="text-muted">Regular Hours</div>
                      <div className="text-success">{analyticsData.payTypeBreakdown.regular.percentage}% of earnings</div>
                    </div>
                  </Col>
                  <Col lg={4}>
                    <div className="text-center p-4 border rounded mb-3">
                      <div className="h4 fw-bold text-warning">{analyticsData.payTypeBreakdown.overtime.hours}h</div>
                      <div className="h5 fw-bold">{formatCurrency(analyticsData.payTypeBreakdown.overtime.earnings)}</div>
                      <div className="text-muted">Overtime Hours</div>
                      <div className="text-success">{analyticsData.payTypeBreakdown.overtime.percentage}% of earnings</div>
                    </div>
                  </Col>
                  <Col lg={4}>
                    <div className="text-center p-4 border rounded mb-3">
                      <div className="h4 fw-bold text-info">{analyticsData.payTypeBreakdown.penalty.hours}h</div>
                      <div className="h5 fw-bold">{formatCurrency(analyticsData.payTypeBreakdown.penalty.earnings)}</div>
                      <div className="text-muted">Penalty Hours</div>
                      <div className="text-success">{analyticsData.payTypeBreakdown.penalty.percentage}% of earnings</div>
                    </div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </Container>
  );
}