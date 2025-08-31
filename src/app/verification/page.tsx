'use client';

import { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Badge, Table, Alert, Spinner } from 'react-bootstrap';
import { CheckCircle, AlertTriangle, Clock, Plus, FileText, TrendingUp } from 'lucide-react';
import Link from 'next/link';

interface PayVerification {
  id: string;
  payPeriodId: string;
  actualGrossPay: number;
  actualTax: number;
  actualNetPay: number;
  actualSuper?: number;
  paySlipReference?: string;
  verificationDate: string;
  status: 'PENDING' | 'MATCHED' | 'DISCREPANCY' | 'RESOLVED';
  notes?: string;
  calculatedGrossPay: number;
  calculatedTax: number;
  calculatedNetPay: number;
  grossPayDifference: number;
  taxDifference: number;
  netPayDifference: number;
  hasDiscrepancy: boolean;
  payPeriod: {
    id: string;
    startDate: string;
    endDate: string;
    payDate?: string;
    status: string;
  };
}

interface VerificationSummary {
  total: number;
  pending: number;
  matched: number;
  discrepancies: number;
  resolved: number;
}

export default function PayVerificationPage() {
  const [verifications, setVerifications] = useState<PayVerification[]>([]);
  const [summary, setSummary] = useState<VerificationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  const fetchVerifications = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = filter ? `?status=${filter}` : '';
      const response = await fetch(`/api/pay-verification${queryParams}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch verifications');
      }
      
      const data = await response.json();
      setVerifications(data.verifications);
      setSummary(data.summary);
    } catch (error) {
      console.error('Error fetching verifications:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchVerifications();
  }, [fetchVerifications]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'MATCHED':
        return <Badge bg="success"><CheckCircle size={14} className="me-1" />Matched</Badge>;
      case 'DISCREPANCY':
        return <Badge bg="warning"><AlertTriangle size={14} className="me-1" />Discrepancy</Badge>;
      case 'RESOLVED':
        return <Badge bg="info">Resolved</Badge>;
      default:
        return <Badge bg="secondary"><Clock size={14} className="me-1" />Pending</Badge>;
    }
  };

  const getDifferenceDisplay = (difference: number) => {
    if (Math.abs(difference) < 0.01) return <span className="text-muted">$0.00</span>;
    
    const isPositive = difference > 0;
    return (
      <span className={isPositive ? 'text-success' : 'text-danger'}>
        {isPositive ? '+' : ''}{formatCurrency(difference)}
      </span>
    );
  };

  if (loading) {
    return (
      <Container fluid className="py-4">
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
          <Spinner animation="border" variant="primary" />
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h1 className="h3 mb-1">Pay Verification</h1>
              <p className="text-muted mb-0">Compare calculated pay with actual pay slips</p>
            </div>
            <Link href="/verification/add">
              <Button variant="primary">
                <Plus size={16} className="me-1" />
                New Verification
              </Button>
            </Link>
          </div>
        </Col>
      </Row>

      {/* Summary Cards */}
      {summary && (
        <Row className="mb-4">
          <Col sm={6} lg={3}>
            <Card className="shadow-sm">
              <Card.Body className="text-center">
                <div className="display-6 text-primary mb-2">{summary.total}</div>
                <div className="fw-bold mb-1">Total Verifications</div>
                <small className="text-muted">All time</small>
              </Card.Body>
            </Card>
          </Col>
          <Col sm={6} lg={3}>
            <Card className="shadow-sm">
              <Card.Body className="text-center">
                <div className="display-6 text-success mb-2">{summary.matched}</div>
                <div className="fw-bold mb-1">Matched</div>
                <small className="text-muted">Perfect matches</small>
              </Card.Body>
            </Card>
          </Col>
          <Col sm={6} lg={3}>
            <Card className="shadow-sm">
              <Card.Body className="text-center">
                <div className="display-6 text-warning mb-2">{summary.discrepancies}</div>
                <div className="fw-bold mb-1">Discrepancies</div>
                <small className="text-muted">Need attention</small>
              </Card.Body>
            </Card>
          </Col>
          <Col sm={6} lg={3}>
            <Card className="shadow-sm">
              <Card.Body className="text-center">
                <div className="display-6 text-info mb-2">{summary.resolved}</div>
                <div className="fw-bold mb-1">Resolved</div>
                <small className="text-muted">Fixed issues</small>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Accuracy Alert */}
      {summary && summary.discrepancies > 0 && (
        <Alert variant="warning" className="mb-4">
          <AlertTriangle size={20} className="me-2" />
          You have {summary.discrepancies} pay {summary.discrepancies === 1 ? 'discrepancy' : 'discrepancies'} that may need attention. 
          Review your calculations or contact your employer if needed.
        </Alert>
      )}

      {/* Filter Buttons */}
      <Row className="mb-3">
        <Col>
          <div className="d-flex gap-2 flex-wrap">
            <Button 
              variant={filter === '' ? 'primary' : 'outline-primary'} 
              size="sm"
              onClick={() => setFilter('')}
            >
              All
            </Button>
            <Button 
              variant={filter === 'pending' ? 'primary' : 'outline-secondary'} 
              size="sm"
              onClick={() => setFilter('pending')}
            >
              Pending
            </Button>
            <Button 
              variant={filter === 'matched' ? 'primary' : 'outline-success'} 
              size="sm"
              onClick={() => setFilter('matched')}
            >
              Matched
            </Button>
            <Button 
              variant={filter === 'discrepancy' ? 'primary' : 'outline-warning'} 
              size="sm"
              onClick={() => setFilter('discrepancy')}
            >
              Discrepancies
            </Button>
          </div>
        </Col>
      </Row>

      {/* Verifications List */}
      <Card className="shadow-sm">
        <Card.Header>
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0">Verification History</h5>
            <small className="text-muted">{verifications.length} verifications</small>
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          {verifications.length === 0 ? (
            <div className="text-center py-5">
              <FileText size={48} className="text-muted mb-3" />
              <h5 className="text-muted">No verifications found</h5>
              <p className="text-muted mb-3">Start by adding your first pay slip verification</p>
              <Link href="/verification/add">
                <Button variant="primary">
                  <Plus size={16} className="me-1" />
                  Add First Verification
                </Button>
              </Link>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover className="mb-0">
                <thead className="table-dark">
                  <tr>
                    <th>Pay Period</th>
                    <th>Status</th>
                    <th className="text-end">Gross Pay</th>
                    <th className="text-end">Tax</th>
                    <th className="text-end">Net Pay</th>
                    <th className="text-end">Difference</th>
                    <th>Verified</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {verifications.map((verification) => (
                    <tr key={verification.id}>
                      <td>
                        <div>
                          <div className="fw-bold">
                            {formatDate(verification.payPeriod.startDate)} - {formatDate(verification.payPeriod.endDate)}
                          </div>
                          {verification.paySlipReference && (
                            <small className="text-muted">Ref: {verification.paySlipReference}</small>
                          )}
                        </div>
                      </td>
                      <td>
                        {getStatusBadge(verification.status)}
                      </td>
                      <td className="text-end">
                        <div>{formatCurrency(verification.actualGrossPay)}</div>
                        <small className="text-muted">{formatCurrency(verification.calculatedGrossPay)}</small>
                      </td>
                      <td className="text-end">
                        <div>{formatCurrency(verification.actualTax)}</div>
                        <small className="text-muted">{formatCurrency(verification.calculatedTax)}</small>
                      </td>
                      <td className="text-end">
                        <div>{formatCurrency(verification.actualNetPay)}</div>
                        <small className="text-muted">{formatCurrency(verification.calculatedNetPay)}</small>
                      </td>
                      <td className="text-end">
                        {getDifferenceDisplay(verification.netPayDifference)}
                      </td>
                      <td>
                        <small className="text-muted">
                          {formatDate(verification.verificationDate)}
                        </small>
                      </td>
                      <td>
                        <Button variant="outline-primary" size="sm">
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Accuracy Metrics */}
      {summary && summary.total > 0 && (
        <Row className="mt-4">
          <Col lg={6}>
            <Card className="shadow-sm">
              <Card.Body>
                <div className="d-flex align-items-center mb-3">
                  <TrendingUp className="text-success me-2" size={24} />
                  <h5 className="mb-0">Verification Accuracy</h5>
                </div>
                <div className="row g-3">
                  <div className="col-4 text-center">
                    <div className="display-6 text-success">
                      {summary.total > 0 ? Math.round((summary.matched / summary.total) * 100) : 0}%
                    </div>
                    <small className="text-muted">Perfect Matches</small>
                  </div>
                  <div className="col-4 text-center">
                    <div className="display-6 text-warning">
                      {summary.total > 0 ? Math.round((summary.discrepancies / summary.total) * 100) : 0}%
                    </div>
                    <small className="text-muted">Discrepancies</small>
                  </div>
                  <div className="col-4 text-center">
                    <div className="display-6 text-info">
                      {summary.total > 0 ? Math.round((summary.resolved / summary.total) * 100) : 0}%
                    </div>
                    <small className="text-muted">Resolved</small>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </Container>
  );
}