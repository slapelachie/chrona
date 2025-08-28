'use client';

import { Alert, Button, Collapse } from 'react-bootstrap';
import { AlertTriangle, ChevronDown, ChevronUp, DollarSign, Info } from 'lucide-react';
import { useState } from 'react';

interface DiscrepancyAlertProps {
  differences: {
    grossPay: number;
    tax: number;
    netPay: number;
    superannuation?: number;
    hecsRepayment?: number;
  };
  tolerance?: number;
  className?: string;
  showDetails?: boolean;
}

export default function DiscrepancyAlert({ 
  differences, 
  tolerance = 1.0,
  className = '',
  showDetails = true 
}: DiscrepancyAlertProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const formatDifference = (amount: number) => {
    if (Math.abs(amount) < 0.01) return '$0.00';
    const isPositive = amount > 0;
    return `${isPositive ? '+' : ''}${formatCurrency(amount)}`;
  };

  const isSignificantDifference = (amount: number) => {
    return Math.abs(amount) > tolerance;
  };

  const getDiscrepancyLevel = () => {
    const grossSignificant = isSignificantDifference(differences.grossPay);
    const taxSignificant = isSignificantDifference(differences.tax);
    const netSignificant = isSignificantDifference(differences.netPay);

    if (grossSignificant || netSignificant) return 'high';
    if (taxSignificant) return 'medium';
    return 'low';
  };

  const discrepancyLevel = getDiscrepancyLevel();
  const alertVariant = discrepancyLevel === 'high' ? 'danger' : 
                      discrepancyLevel === 'medium' ? 'warning' : 'info';

  const getDiscrepancyMessage = () => {
    const significantDifferences = [];
    
    if (isSignificantDifference(differences.grossPay)) {
      significantDifferences.push(`Gross Pay (${formatDifference(differences.grossPay)})`);
    }
    if (isSignificantDifference(differences.tax)) {
      significantDifferences.push(`Tax (${formatDifference(differences.tax)})`);
    }
    if (isSignificantDifference(differences.netPay)) {
      significantDifferences.push(`Net Pay (${formatDifference(differences.netPay)})`);
    }

    if (significantDifferences.length === 0) {
      return 'Minor differences detected within tolerance range.';
    }

    return `Significant discrepancies found in: ${significantDifferences.join(', ')}.`;
  };

  const getRecommendations = () => {
    const recommendations = [];
    
    if (discrepancyLevel === 'high') {
      recommendations.push('Double-check your pay slip amounts for any data entry errors');
      recommendations.push('Review your shift times and break deductions');
      if (isSignificantDifference(differences.grossPay)) {
        recommendations.push('Verify overtime and penalty rates were applied correctly');
      }
      recommendations.push('Contact your payroll department if the discrepancy persists');
    } else if (discrepancyLevel === 'medium') {
      recommendations.push('Review tax calculations and HECS repayment amounts');
      recommendations.push('Check if your tax-free threshold declaration is current');
    } else {
      recommendations.push('Small differences are normal due to rounding');
      recommendations.push('Consider resolving this verification to clear the status');
    }

    return recommendations;
  };

  const totalAbsoluteDifference = Math.abs(differences.grossPay) + 
                                  Math.abs(differences.tax) + 
                                  Math.abs(differences.netPay);

  return (
    <Alert variant={alertVariant} className={className}>
      <div className="d-flex align-items-start">
        <AlertTriangle size={20} className="me-2 mt-1 flex-shrink-0" />
        <div className="flex-grow-1">
          <div className="fw-bold mb-1">
            {discrepancyLevel === 'high' && 'Significant Pay Discrepancy Detected'}
            {discrepancyLevel === 'medium' && 'Pay Discrepancy Found'}
            {discrepancyLevel === 'low' && 'Minor Pay Differences'}
          </div>
          
          <div className="mb-2">
            {getDiscrepancyMessage()}
          </div>

          {/* Key Differences Summary */}
          <div className="mb-2">
            <small className="d-block">
              <DollarSign size={14} className="me-1" />
              <strong>Net Impact:</strong> {formatDifference(differences.netPay)}
              {totalAbsoluteDifference > tolerance && (
                <span className="text-muted ms-2">
                  (Total variance: {formatCurrency(totalAbsoluteDifference)})
                </span>
              )}
            </small>
          </div>

          {/* Toggle Details Button */}
          {showDetails && (
            <div className="d-flex justify-content-between align-items-center">
              <Button 
                variant="link" 
                size="sm" 
                className="p-0 text-decoration-none"
                onClick={() => setShowBreakdown(!showBreakdown)}
              >
                {showBreakdown ? (
                  <>
                    <ChevronUp size={16} className="me-1" />
                    Hide Details
                  </>
                ) : (
                  <>
                    <ChevronDown size={16} className="me-1" />
                    Show Details
                  </>
                )}
              </Button>
              
              <small className="text-muted">
                Tolerance: ±{formatCurrency(tolerance)}
              </small>
            </div>
          )}

          {/* Detailed Breakdown */}
          <Collapse in={showBreakdown}>
            <div className="mt-3">
              <div className="row g-2 mb-3">
                <div className="col-sm-6 col-md-3">
                  <div className={`p-2 rounded ${isSignificantDifference(differences.grossPay) ? 'bg-danger bg-opacity-10' : 'bg-light'}`}>
                    <small className="text-muted d-block">Gross Pay</small>
                    <div className={`fw-bold ${isSignificantDifference(differences.grossPay) ? 'text-danger' : 'text-muted'}`}>
                      {formatDifference(differences.grossPay)}
                    </div>
                  </div>
                </div>
                
                <div className="col-sm-6 col-md-3">
                  <div className={`p-2 rounded ${isSignificantDifference(differences.tax) ? 'bg-warning bg-opacity-10' : 'bg-light'}`}>
                    <small className="text-muted d-block">Tax</small>
                    <div className={`fw-bold ${isSignificantDifference(differences.tax) ? 'text-warning' : 'text-muted'}`}>
                      {formatDifference(differences.tax)}
                    </div>
                  </div>
                </div>
                
                <div className="col-sm-6 col-md-3">
                  <div className={`p-2 rounded ${isSignificantDifference(differences.netPay) ? 'bg-danger bg-opacity-10' : 'bg-light'}`}>
                    <small className="text-muted d-block">Net Pay</small>
                    <div className={`fw-bold ${isSignificantDifference(differences.netPay) ? 'text-danger' : 'text-muted'}`}>
                      {formatDifference(differences.netPay)}
                    </div>
                  </div>
                </div>
                
                {differences.superannuation !== undefined && (
                  <div className="col-sm-6 col-md-3">
                    <div className={`p-2 rounded ${isSignificantDifference(differences.superannuation) ? 'bg-info bg-opacity-10' : 'bg-light'}`}>
                      <small className="text-muted d-block">Super</small>
                      <div className={`fw-bold ${isSignificantDifference(differences.superannuation) ? 'text-info' : 'text-muted'}`}>
                        {formatDifference(differences.superannuation)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Recommendations */}
              <div className="bg-light p-3 rounded">
                <div className="d-flex align-items-start mb-2">
                  <Info size={16} className="me-2 mt-1 flex-shrink-0" />
                  <div>
                    <div className="fw-bold mb-2">Recommended Actions:</div>
                    <ul className="mb-0 ps-3">
                      {getRecommendations().map((recommendation, index) => (
                        <li key={index} className="mb-1">
                          <small>{recommendation}</small>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </Collapse>
        </div>
      </div>
    </Alert>
  );
}