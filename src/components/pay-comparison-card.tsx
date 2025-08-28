'use client';

import { useState, useEffect } from 'react';
import { Card, Table, Spinner, Badge, Alert } from 'react-bootstrap';
import { Calculator, FileText, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import DiscrepancyAlert from './discrepancy-alert';

interface PayComparison {
  payPeriod: {
    id: string;
    startDate: string;
    endDate: string;
    payDate?: string;
    status: string;
  };
  calculated: {
    grossPay: number;
    tax: number;
    netPay: number;
    superannuation: number;
    hecsRepayment: number;
    medicareLevy: number;
    totalHours: number;
    shiftsCount: number;
    breakdown: {
      incomeTax: number;
      medicareLevy: number;
      hecsRepayment: number;
    };
  };
  actual?: {
    grossPay: number;
    tax: number;
    netPay: number;
    superannuation: number;
    hecsRepayment: number;
    paySlipReference?: string;
    verificationDate: string;
  };
  differences?: {
    grossPay: number;
    tax: number;
    netPay: number;
    superannuation: number;
    hecsRepayment: number;
  };
  shifts: Array<{
    id: string;
    date: string;
    startTime: Date;
    endTime?: Date;
    totalMinutes?: number;
    regularHours: number;
    overtimeHours: number;
    penaltyHours: number;
    grossPay: number;
    superannuation: number;
    shiftType: string;
    baseRate: number;
    casualLoading: number;
    notes?: string;
  }>;
  hasVerification: boolean;
  verificationStatus: string;
  tolerance: number;
}

interface PayComparisonCardProps {
  payPeriodId: string;
  showActual?: boolean;
  className?: string;
}

export default function PayComparisonCard({ 
  payPeriodId, 
  showActual = true,
  className = ''
}: PayComparisonCardProps) {
  const [comparison, setComparison] = useState<PayComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchComparison();
  }, [payPeriodId]); // fetchComparison is recreated on each render, which is fine for this use case

  const fetchComparison = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`/api/pay-verification/compare/${payPeriodId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch pay comparison');
      }
      
      const data = await response.json();
      setComparison(data);
    } catch (error) {
      console.error('Error fetching pay comparison:', error);
      setError(error instanceof Error ? error.message : 'Failed to load comparison');
    } finally {
      setLoading(false);
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

  const getDifferenceDisplay = (difference: number, tolerance: number = 1.0) => {
    if (Math.abs(difference) < 0.01) {
      return <span className="text-muted">$0.00</span>;
    }
    
    const isSignificant = Math.abs(difference) > tolerance;
    const isPositive = difference > 0;
    const colorClass = isSignificant 
      ? (isPositive ? 'text-success fw-bold' : 'text-danger fw-bold')
      : (isPositive ? 'text-success' : 'text-danger');
    
    return (
      <span className={colorClass}>
        {isPositive ? '+' : ''}{formatCurrency(difference)}
      </span>
    );
  };

  const getVerificationStatusBadge = (status: string) => {
    switch (status) {
      case 'MATCHED':
        return <Badge bg="success"><CheckCircle size={14} className="me-1" />Verified</Badge>;
      case 'DISCREPANCY':
        return <Badge bg="warning"><AlertTriangle size={14} className="me-1" />Discrepancy</Badge>;
      case 'RESOLVED':
        return <Badge bg="info">Resolved</Badge>;
      default:
        return <Badge bg="secondary"><Clock size={14} className="me-1" />Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <Card className={`shadow-sm ${className}`}>
        <Card.Body className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <div className="mt-2">Loading comparison...</div>
        </Card.Body>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`shadow-sm ${className}`}>
        <Card.Body>
          <Alert variant="danger" className="mb-0">
            <AlertTriangle size={20} className="me-2" />
            {error}
          </Alert>
        </Card.Body>
      </Card>
    );
  }

  if (!comparison) {
    return (
      <Card className={`shadow-sm ${className}`}>
        <Card.Body className="text-center py-5">
          <FileText size={48} className="text-muted mb-3" />
          <h6 className="text-muted">No comparison data available</h6>
        </Card.Body>
      </Card>
    );
  }

  const hasDiscrepancies = comparison.differences && (
    Math.abs(comparison.differences.grossPay) > comparison.tolerance ||
    Math.abs(comparison.differences.tax) > comparison.tolerance ||
    Math.abs(comparison.differences.netPay) > comparison.tolerance
  );

  return (
    <div className={className}>
      <Card className="shadow-sm">
        <Card.Header>
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0">
              <Calculator size={20} className="me-2" />
              Pay Comparison
            </h5>
            {comparison.hasVerification && (
              <div>
                {getVerificationStatusBadge(comparison.verificationStatus)}
              </div>
            )}
          </div>
        </Card.Header>
        <Card.Body>
          {/* Pay Period Info */}
          <div className="mb-3 p-3 bg-light rounded">
            <div className="fw-bold">
              {formatDate(comparison.payPeriod.startDate)} - {formatDate(comparison.payPeriod.endDate)}
            </div>
            <small className="text-muted">
              {comparison.calculated.shiftsCount} shifts • {comparison.calculated.totalHours.toFixed(1)} hours
              {comparison.payPeriod.payDate && (
                <> • Pay Date: {formatDate(comparison.payPeriod.payDate)}</>
              )}
            </small>
          </div>

          {/* Discrepancy Alert */}
          {hasDiscrepancies && comparison.differences && (
            <DiscrepancyAlert 
              differences={comparison.differences}
              tolerance={comparison.tolerance}
              className="mb-3"
            />
          )}

          {/* Comparison Table */}
          <div className="table-responsive">
            <Table size="sm" className="mb-0">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-end">Calculated</th>
                  {showActual && comparison.hasVerification && (
                    <>
                      <th className="text-end">Actual</th>
                      <th className="text-end">Difference</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="fw-bold">Gross Pay</td>
                  <td className="text-end">{formatCurrency(comparison.calculated.grossPay)}</td>
                  {showActual && comparison.hasVerification && comparison.actual && (
                    <>
                      <td className="text-end">{formatCurrency(comparison.actual.grossPay)}</td>
                      <td className="text-end">
                        {comparison.differences && getDifferenceDisplay(comparison.differences.grossPay, comparison.tolerance)}
                      </td>
                    </>
                  )}
                </tr>
                
                <tr>
                  <td>Income Tax</td>
                  <td className="text-end">{formatCurrency(comparison.calculated.breakdown.incomeTax)}</td>
                  {showActual && comparison.hasVerification && comparison.actual && (
                    <>
                      <td className="text-end">
                        {formatCurrency((comparison.actual.tax || 0) - (comparison.actual.hecsRepayment || 0))}
                      </td>
                      <td className="text-end">
                        {comparison.differences && getDifferenceDisplay(
                          (comparison.differences.tax || 0) - (comparison.differences.hecsRepayment || 0),
                          comparison.tolerance
                        )}
                      </td>
                    </>
                  )}
                </tr>
                
                <tr>
                  <td>Medicare Levy</td>
                  <td className="text-end">{formatCurrency(comparison.calculated.breakdown.medicareLevy)}</td>
                  {showActual && comparison.hasVerification && comparison.actual && (
                    <>
                      <td className="text-end">—</td>
                      <td className="text-end">—</td>
                    </>
                  )}
                </tr>
                
                {comparison.calculated.breakdown.hecsRepayment > 0 && (
                  <tr>
                    <td>HECS Repayment</td>
                    <td className="text-end">{formatCurrency(comparison.calculated.breakdown.hecsRepayment)}</td>
                    {showActual && comparison.hasVerification && comparison.actual && (
                      <>
                        <td className="text-end">{formatCurrency(comparison.actual.hecsRepayment || 0)}</td>
                        <td className="text-end">
                          {comparison.differences && getDifferenceDisplay(comparison.differences.hecsRepayment || 0, comparison.tolerance)}
                        </td>
                      </>
                    )}
                  </tr>
                )}
                
                <tr className="table-secondary">
                  <td className="fw-bold">Total Tax</td>
                  <td className="text-end fw-bold">{formatCurrency(comparison.calculated.tax)}</td>
                  {showActual && comparison.hasVerification && comparison.actual && (
                    <>
                      <td className="text-end fw-bold">{formatCurrency(comparison.actual.tax)}</td>
                      <td className="text-end fw-bold">
                        {comparison.differences && getDifferenceDisplay(comparison.differences.tax, comparison.tolerance)}
                      </td>
                    </>
                  )}
                </tr>
                
                <tr className="table-primary">
                  <td className="fw-bold">Net Pay</td>
                  <td className="text-end fw-bold">{formatCurrency(comparison.calculated.netPay)}</td>
                  {showActual && comparison.hasVerification && comparison.actual && (
                    <>
                      <td className="text-end fw-bold">{formatCurrency(comparison.actual.netPay)}</td>
                      <td className="text-end fw-bold">
                        {comparison.differences && getDifferenceDisplay(comparison.differences.netPay, comparison.tolerance)}
                      </td>
                    </>
                  )}
                </tr>
                
                <tr>
                  <td>Superannuation</td>
                  <td className="text-end">{formatCurrency(comparison.calculated.superannuation)}</td>
                  {showActual && comparison.hasVerification && comparison.actual && (
                    <>
                      <td className="text-end">{formatCurrency(comparison.actual.superannuation || 0)}</td>
                      <td className="text-end">
                        {comparison.differences && getDifferenceDisplay(comparison.differences.superannuation || 0, comparison.tolerance)}
                      </td>
                    </>
                  )}
                </tr>
              </tbody>
            </Table>
          </div>

          {/* Verification Info */}
          {comparison.hasVerification && comparison.actual && (
            <div className="mt-3 pt-3 border-top">
              <div className="d-flex justify-content-between align-items-center">
                <small className="text-muted">
                  Verified on {formatDate(comparison.actual.verificationDate)}
                  {comparison.actual.paySlipReference && (
                    <> • Ref: {comparison.actual.paySlipReference}</>
                  )}
                </small>
                <small className="text-muted">
                  Tolerance: ±{formatCurrency(comparison.tolerance)}
                </small>
              </div>
            </div>
          )}

          {/* No Verification Message */}
          {!comparison.hasVerification && (
            <div className="mt-3 pt-3 border-top text-center">
              <small className="text-muted">
                <Clock size={16} className="me-1" />
                No verification data available for this pay period
              </small>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}