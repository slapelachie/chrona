'use client';

import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Alert, Spinner } from 'react-bootstrap';
import { ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PayVerificationForm from '@/components/pay-verification-form';
import PayComparisonCard from '@/components/pay-comparison-card';

interface PayPeriod {
  id: string;
  startDate: string;
  endDate: string;
  payDate?: string;
  status: string;
  totalGrossPay?: number;
  totalTax?: number;
  totalNetPay?: number;
  superannuation?: number;
  shiftsCount: number;
  hasVerification: boolean;
}

export default function AddVerificationPage() {
  const router = useRouter();
  const [payPeriods, setPayPeriods] = useState<PayPeriod[]>([]);
  const [selectedPayPeriod, setSelectedPayPeriod] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  useEffect(() => {
    fetchPayPeriods();
  }, []);

  const fetchPayPeriods = async () => {
    try {
      setLoading(true);
      // Fetch pay periods that don't have verifications or need updates
      const response = await fetch('/api/dashboard');
      
      if (!response.ok) {
        throw new Error('Failed to fetch pay periods');
      }
      
      // For now, we'll create a mock list of pay periods
      // In a real app, you'd have an endpoint specifically for this
      const mockPayPeriods: PayPeriod[] = [
        {
          id: 'pp1',
          startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
          payDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'OPEN',
          totalGrossPay: 1580.50,
          totalTax: 300.20,
          totalNetPay: 1280.30,
          superannuation: 173.86,
          shiftsCount: 8,
          hasVerification: false
        },
        {
          id: 'pp2',
          startDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          payDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'PAID',
          totalGrossPay: 1623.75,
          totalTax: 318.50,
          totalNetPay: 1305.25,
          superannuation: 178.61,
          shiftsCount: 9,
          hasVerification: false
        }
      ];

      setPayPeriods(mockPayPeriods);
      if (mockPayPeriods.length > 0) {
        setSelectedPayPeriod(mockPayPeriods[0].id);
      }
    } catch (error) {
      console.error('Error fetching pay periods:', error);
      setError('Failed to load pay periods');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (formData: {
    actualGrossPay: number;
    actualTax: number;
    actualNetPay: number;
    actualSuper?: number;
    actualHECS?: number;
    paySlipReference?: string;
    notes?: string;
  }) => {
    if (!selectedPayPeriod) {
      setError('Please select a pay period');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/pay-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payPeriodId: selectedPayPeriod,
          ...formData
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create verification');
      }

      const result = await response.json();
      
      if (result.verification.hasDiscrepancy) {
        setSuccess('Verification created! Pay discrepancy detected - please review the differences.');
      } else {
        setSuccess('Verification created successfully! Pay amounts match perfectly.');
      }

      // Redirect to verification details after a delay
      setTimeout(() => {
        router.push('/verification');
      }, 2000);

    } catch (error) {
      console.error('Error creating verification:', error);
      setError(error instanceof Error ? error.message : 'Failed to create verification');
    } finally {
      setSubmitting(false);
    }
  };

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

  const selectedPeriod = payPeriods.find(p => p.id === selectedPayPeriod);

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
          <div className="d-flex align-items-center">
            <Link href="/verification" passHref legacyBehavior>
              <Button variant="outline-secondary" className="me-3">
                <ArrowLeft size={16} />
              </Button>
            </Link>
            <div>
              <h1 className="h3 mb-1">Add Pay Verification</h1>
              <p className="text-muted mb-0">Enter your actual pay slip details to verify against calculated amounts</p>
            </div>
          </div>
        </Col>
      </Row>

      {/* Alerts */}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success">
          <FileText size={20} className="me-2" />
          {success}
        </Alert>
      )}

      {payPeriods.length === 0 ? (
        <Card className="shadow-sm">
          <Card.Body className="text-center py-5">
            <FileText size={48} className="text-muted mb-3" />
            <h5 className="text-muted">No Pay Periods Available</h5>
            <p className="text-muted mb-3">You need to have worked shifts before you can verify your pay</p>
            <Link href="/shifts" passHref legacyBehavior>
              <Button variant="primary">Add Your First Shift</Button>
            </Link>
          </Card.Body>
        </Card>
      ) : (
        <Row>
          {/* Left Column - Form */}
          <Col lg={6}>
            <Card className="shadow-sm">
              <Card.Header>
                <h5 className="mb-0">Pay Slip Details</h5>
              </Card.Header>
              <Card.Body>
                {/* Pay Period Selection */}
                <div className="mb-4">
                  <label className="form-label fw-bold">Select Pay Period</label>
                  <select 
                    className="form-select"
                    value={selectedPayPeriod}
                    onChange={(e) => setSelectedPayPeriod(e.target.value)}
                  >
                    <option value="">Choose a pay period...</option>
                    {payPeriods.map((period) => (
                      <option key={period.id} value={period.id}>
                        {formatDate(period.startDate)} - {formatDate(period.endDate)}
                        {period.hasVerification && ' (Already Verified)'}
                      </option>
                    ))}
                  </select>
                  
                  {selectedPeriod && (
                    <div className="mt-2 p-3 bg-light rounded">
                      <small className="text-muted">
                        <strong>Period Summary:</strong> {selectedPeriod.shiftsCount} shifts • 
                        Expected: {formatCurrency(selectedPeriod.totalNetPay || 0)} net pay
                        {selectedPeriod.payDate && (
                          <> • Pay Date: {formatDate(selectedPeriod.payDate)}</>
                        )}
                      </small>
                    </div>
                  )}
                </div>

                {/* Form */}
                {selectedPayPeriod && (
                  <PayVerificationForm
                    onSubmit={handleFormSubmit}
                    submitting={submitting}
                    expectedValues={{
                      grossPay: selectedPeriod?.totalGrossPay || 0,
                      tax: selectedPeriod?.totalTax || 0,
                      netPay: selectedPeriod?.totalNetPay || 0,
                      superannuation: selectedPeriod?.superannuation || 0
                    }}
                  />
                )}
              </Card.Body>
            </Card>
          </Col>

          {/* Right Column - Comparison */}
          <Col lg={6}>
            {selectedPayPeriod && (
              <PayComparisonCard 
                payPeriodId={selectedPayPeriod}
                showActual={false}
              />
            )}
          </Col>
        </Row>
      )}
    </Container>
  );
}