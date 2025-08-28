'use client';

import { useState } from 'react';
import { Form, Button, Row, Col, InputGroup, Alert } from 'react-bootstrap';
import { DollarSign, FileText, AlertTriangle } from 'lucide-react';

interface PayVerificationFormProps {
  onSubmit: (data: {
    actualGrossPay: number;
    actualTax: number;
    actualNetPay: number;
    actualSuper?: number;
    actualHECS?: number;
    paySlipReference?: string;
    notes?: string;
  }) => void;
  submitting?: boolean;
  expectedValues?: {
    grossPay: number;
    tax: number;
    netPay: number;
    superannuation: number;
  };
  initialValues?: {
    actualGrossPay?: number;
    actualTax?: number;
    actualNetPay?: number;
    actualSuper?: number;
    actualHECS?: number;
    paySlipReference?: string;
    notes?: string;
  };
}

export default function PayVerificationForm({ 
  onSubmit, 
  submitting = false, 
  expectedValues,
  initialValues = {}
}: PayVerificationFormProps) {
  const [formData, setFormData] = useState({
    actualGrossPay: initialValues.actualGrossPay?.toString() || '',
    actualTax: initialValues.actualTax?.toString() || '',
    actualNetPay: initialValues.actualNetPay?.toString() || '',
    actualSuper: initialValues.actualSuper?.toString() || '',
    actualHECS: initialValues.actualHECS?.toString() || '',
    paySlipReference: initialValues.paySlipReference || '',
    notes: initialValues.notes || ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDifferences, setShowDifferences] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const parseCurrency = (value: string): number => {
    // Remove currency symbols and parse
    return parseFloat(value.replace(/[$,\s]/g, '')) || 0;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Required fields
    if (!formData.actualGrossPay) {
      newErrors.actualGrossPay = 'Gross pay is required';
    } else if (parseCurrency(formData.actualGrossPay) <= 0) {
      newErrors.actualGrossPay = 'Gross pay must be greater than $0';
    }

    if (!formData.actualTax) {
      newErrors.actualTax = 'Tax amount is required';
    } else if (parseCurrency(formData.actualTax) < 0) {
      newErrors.actualTax = 'Tax amount cannot be negative';
    }

    if (!formData.actualNetPay) {
      newErrors.actualNetPay = 'Net pay is required';
    } else if (parseCurrency(formData.actualNetPay) <= 0) {
      newErrors.actualNetPay = 'Net pay must be greater than $0';
    }

    // Logical validation
    const grossPay = parseCurrency(formData.actualGrossPay);
    const tax = parseCurrency(formData.actualTax);
    const netPay = parseCurrency(formData.actualNetPay);

    if (grossPay > 0 && tax >= 0 && netPay > 0) {
      const expectedNet = grossPay - tax;
      if (Math.abs(netPay - expectedNet) > 5) {
        newErrors.netPay = `Net pay (${formatCurrency(netPay)}) doesn't match gross minus tax (${formatCurrency(expectedNet)})`;
      }
    }

    // Superannuation validation
    if (formData.actualSuper && parseCurrency(formData.actualSuper) < 0) {
      newErrors.actualSuper = 'Superannuation cannot be negative';
    }

    // HECS validation
    if (formData.actualHECS && parseCurrency(formData.actualHECS) < 0) {
      newErrors.actualHECS = 'HECS repayment cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const submitData = {
      actualGrossPay: parseCurrency(formData.actualGrossPay),
      actualTax: parseCurrency(formData.actualTax),
      actualNetPay: parseCurrency(formData.actualNetPay),
      actualSuper: formData.actualSuper ? parseCurrency(formData.actualSuper) : undefined,
      actualHECS: formData.actualHECS ? parseCurrency(formData.actualHECS) : undefined,
      paySlipReference: formData.paySlipReference || undefined,
      notes: formData.notes || undefined
    };

    onSubmit(submitData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }

    // Show differences when values are entered
    if (expectedValues && (field === 'actualGrossPay' || field === 'actualTax' || field === 'actualNetPay')) {
      setShowDifferences(true);
    }
  };

  const getDifference = (actual: string, expected: number): number => {
    return parseCurrency(actual) - expected;
  };

  const getDifferenceDisplay = (actual: string, expected: number) => {
    if (!actual || !expected) return null;
    
    const diff = getDifference(actual, expected);
    if (Math.abs(diff) < 0.01) return null;
    
    const isPositive = diff > 0;
    const color = Math.abs(diff) > 1 ? (isPositive ? 'text-success' : 'text-danger') : 'text-muted';
    
    return (
      <small className={`${color} d-block mt-1`}>
        {isPositive ? '+' : ''}{formatCurrency(diff)} vs calculated
      </small>
    );
  };

  return (
    <Form onSubmit={handleSubmit}>
      {/* Main Pay Fields */}
      <Row className="mb-3">
        <Col md={6}>
          <Form.Group>
            <Form.Label className="fw-bold">
              <DollarSign size={16} className="me-1" />
              Gross Pay *
            </Form.Label>
            <InputGroup>
              <InputGroup.Text>$</InputGroup.Text>
              <Form.Control
                type="text"
                placeholder="0.00"
                value={formData.actualGrossPay}
                onChange={(e) => handleInputChange('actualGrossPay', e.target.value)}
                isInvalid={!!errors.actualGrossPay}
                disabled={submitting}
              />
              <Form.Control.Feedback type="invalid">
                {errors.actualGrossPay}
              </Form.Control.Feedback>
            </InputGroup>
            {expectedValues && showDifferences && 
              getDifferenceDisplay(formData.actualGrossPay, expectedValues.grossPay)
            }
          </Form.Group>
        </Col>
        
        <Col md={6}>
          <Form.Group>
            <Form.Label className="fw-bold">Tax Withheld *</Form.Label>
            <InputGroup>
              <InputGroup.Text>$</InputGroup.Text>
              <Form.Control
                type="text"
                placeholder="0.00"
                value={formData.actualTax}
                onChange={(e) => handleInputChange('actualTax', e.target.value)}
                isInvalid={!!errors.actualTax}
                disabled={submitting}
              />
              <Form.Control.Feedback type="invalid">
                {errors.actualTax}
              </Form.Control.Feedback>
            </InputGroup>
            {expectedValues && showDifferences && 
              getDifferenceDisplay(formData.actualTax, expectedValues.tax)
            }
          </Form.Group>
        </Col>
      </Row>

      <Row className="mb-3">
        <Col md={6}>
          <Form.Group>
            <Form.Label className="fw-bold">Net Pay *</Form.Label>
            <InputGroup>
              <InputGroup.Text>$</InputGroup.Text>
              <Form.Control
                type="text"
                placeholder="0.00"
                value={formData.actualNetPay}
                onChange={(e) => handleInputChange('actualNetPay', e.target.value)}
                isInvalid={!!errors.actualNetPay || !!errors.netPay}
                disabled={submitting}
              />
              <Form.Control.Feedback type="invalid">
                {errors.actualNetPay || errors.netPay}
              </Form.Control.Feedback>
            </InputGroup>
            {expectedValues && showDifferences && 
              getDifferenceDisplay(formData.actualNetPay, expectedValues.netPay)
            }
          </Form.Group>
        </Col>
        
        <Col md={6}>
          <Form.Group>
            <Form.Label className="fw-bold">Superannuation</Form.Label>
            <InputGroup>
              <InputGroup.Text>$</InputGroup.Text>
              <Form.Control
                type="text"
                placeholder="0.00"
                value={formData.actualSuper}
                onChange={(e) => handleInputChange('actualSuper', e.target.value)}
                isInvalid={!!errors.actualSuper}
                disabled={submitting}
              />
              <Form.Control.Feedback type="invalid">
                {errors.actualSuper}
              </Form.Control.Feedback>
            </InputGroup>
            {expectedValues && showDifferences && formData.actualSuper &&
              getDifferenceDisplay(formData.actualSuper, expectedValues.superannuation)
            }
          </Form.Group>
        </Col>
      </Row>

      {/* Additional Fields */}
      <Row className="mb-3">
        <Col md={6}>
          <Form.Group>
            <Form.Label className="fw-bold">HECS Repayment</Form.Label>
            <InputGroup>
              <InputGroup.Text>$</InputGroup.Text>
              <Form.Control
                type="text"
                placeholder="0.00"
                value={formData.actualHECS}
                onChange={(e) => handleInputChange('actualHECS', e.target.value)}
                isInvalid={!!errors.actualHECS}
                disabled={submitting}
              />
              <Form.Control.Feedback type="invalid">
                {errors.actualHECS}
              </Form.Control.Feedback>
            </InputGroup>
          </Form.Group>
        </Col>
        
        <Col md={6}>
          <Form.Group>
            <Form.Label className="fw-bold">
              <FileText size={16} className="me-1" />
              Pay Slip Reference
            </Form.Label>
            <Form.Control
              type="text"
              placeholder="e.g., PS-2024-001"
              value={formData.paySlipReference}
              onChange={(e) => handleInputChange('paySlipReference', e.target.value)}
              disabled={submitting}
            />
          </Form.Group>
        </Col>
      </Row>

      {/* Notes */}
      <Form.Group className="mb-4">
        <Form.Label className="fw-bold">Notes</Form.Label>
        <Form.Control
          as="textarea"
          rows={3}
          placeholder="Any additional notes about this pay period or discrepancies..."
          value={formData.notes}
          onChange={(e) => handleInputChange('notes', e.target.value)}
          disabled={submitting}
        />
      </Form.Group>

      {/* Discrepancy Warning */}
      {expectedValues && showDifferences && (
        (() => {
          const grossDiff = Math.abs(getDifference(formData.actualGrossPay, expectedValues.grossPay));
          const taxDiff = Math.abs(getDifference(formData.actualTax, expectedValues.tax));
          const netDiff = Math.abs(getDifference(formData.actualNetPay, expectedValues.netPay));
          const hasSignificantDiff = grossDiff > 1 || taxDiff > 1 || netDiff > 1;

          if (hasSignificantDiff) {
            return (
              <Alert variant="warning" className="mb-4">
                <AlertTriangle size={20} className="me-2" />
                <strong>Significant differences detected!</strong> 
                <div className="mt-1">
                  The amounts you&apos;ve entered differ significantly from our calculations. 
                  This may indicate an error in our calculations or your pay slip. 
                  Please double-check the amounts and add notes if needed.
                </div>
              </Alert>
            );
          }
          return null;
        })()
      )}

      {/* Submit Button */}
      <div className="d-grid">
        <Button 
          type="submit" 
          variant="primary" 
          size="lg"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" />
              Verifying Pay...
            </>
          ) : (
            'Verify Pay'
          )}
        </Button>
      </div>
    </Form>
  );
}