'use client';

import { useState, useEffect } from 'react';
import { Form, Badge, Button, Spinner, Alert } from 'react-bootstrap';
import { DollarSign, Clock, Info, Star, RefreshCw } from 'lucide-react';
import Decimal from 'decimal.js';

interface PayGuide {
  id: string;
  name: string;
  baseHourlyRate: string;
  casualLoading: string;
  overtimeRate1_5x: string;
  overtimeRate2x: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
}

interface PayRateSelectorProps {
  selectedPayGuideId?: string;
  onPayGuideChange: (payGuideId: string | undefined) => void;
  className?: string;
  size?: 'sm' | 'lg';
  showDetails?: boolean;
  allowEmpty?: boolean;
  defaultToLastUsed?: boolean;
}

export default function PayRateSelector({
  selectedPayGuideId,
  onPayGuideChange,
  className = '',
  size,
  showDetails = true,
  allowEmpty = false,
  defaultToLastUsed = true
}: PayRateSelectorProps) {
  const [payGuides, setPayGuides] = useState<PayGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUsedPayGuideId, setLastUsedPayGuideId] = useState<string | null>(null);

  const fetchPayGuides = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/pay-rates?active=true');
      
      if (!response.ok) {
        throw new Error('Failed to fetch pay guides');
      }

      const data = await response.json();
      setPayGuides(data);
      setError(null);
    } catch (error) {
      console.error('Error fetching pay guides:', error);
      setError('Failed to load pay guides');
    } finally {
      setLoading(false);
    }
  };

  const loadLastUsedPayGuide = async () => {
    try {
      const response = await fetch('/api/user/preferences');
      if (response.ok) {
        const data = await response.json();
        if (data.lastUsedPayGuideId) {
          setLastUsedPayGuideId(data.lastUsedPayGuideId);
          if (!selectedPayGuideId && defaultToLastUsed) {
            onPayGuideChange(data.lastUsedPayGuideId);
          }
        }
      }
    } catch (error) {
      console.error('Error loading last used pay guide:', error);
    }
  };

  useEffect(() => {
    fetchPayGuides();
    if (defaultToLastUsed) {
      loadLastUsedPayGuide();
    }
  }, [defaultToLastUsed]);


  const saveLastUsedPayGuide = (payGuideId: string) => {
    try {
      localStorage.setItem('lastUsedPayGuideId', payGuideId);
      setLastUsedPayGuideId(payGuideId);
    } catch (error) {
      console.warn('Failed to save last used pay guide to localStorage:', error);
    }
  };

  const handlePayGuideChange = (value: string) => {
    const payGuideId = value || undefined;
    onPayGuideChange(payGuideId);
    
    if (payGuideId) {
      saveLastUsedPayGuide(payGuideId);
    }
  };

  const formatCurrency = (amount: string) => {
    return new Decimal(amount).toFixed(2);
  };

  const formatPercentage = (rate: string) => {
    const decimal = new Decimal(rate);
    const percentage = decimal.sub(1).mul(100);
    return `${percentage.toFixed(0)}%`;
  };

  const selectedPayGuide = payGuides.find(guide => guide.id === selectedPayGuideId);

  if (loading) {
    return (
      <Form.Group className={className}>
        <Form.Label>Pay Rate</Form.Label>
        <div className="d-flex align-items-center p-2 border rounded">
          <Spinner animation="border" size="sm" className="me-2" />
          <span className="text-muted">Loading pay guides...</span>
        </div>
      </Form.Group>
    );
  }

  if (error) {
    return (
      <Form.Group className={className}>
        <Form.Label>Pay Rate</Form.Label>
        <Alert variant="warning" className="py-2 mb-0">
          <div className="d-flex align-items-center justify-content-between">
            <span>{error}</span>
            <Button 
              variant="outline-warning" 
              size="sm" 
              onClick={fetchPayGuides}
            >
              <RefreshCw size={14} className="me-1" />
              Retry
            </Button>
          </div>
        </Alert>
      </Form.Group>
    );
  }

  return (
    <Form.Group className={className}>
      <Form.Label className="d-flex align-items-center">
        <DollarSign size={16} className="me-1" />
        Pay Rate
      </Form.Label>
      
      <Form.Select
        value={selectedPayGuideId || ''}
        onChange={(e) => handlePayGuideChange(e.target.value)}
        size={size}
      >
        {allowEmpty && (
          <option value="">Select a pay guide...</option>
        )}
        
        {payGuides.length === 0 ? (
          <option disabled>No active pay guides available</option>
        ) : (
          payGuides.map(guide => (
            <option key={guide.id} value={guide.id}>
              {guide.name} - ${formatCurrency(guide.baseHourlyRate)}/hr
              {guide.id === lastUsedPayGuideId ? ' (Last Used)' : ''}
            </option>
          ))
        )}
      </Form.Select>
      
      {payGuides.length === 0 && (
        <Form.Text className="text-muted">
          <Info size={12} className="me-1" />
          No active pay guides found. Create one in <a href="/pay-rates">Pay Rate Management</a>.
        </Form.Text>
      )}
      
      {showDetails && selectedPayGuide && (
        <div className="mt-2 p-2 bg-light rounded">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <small className="text-muted fw-bold">{selectedPayGuide.name}</small>
            {selectedPayGuide.id === lastUsedPayGuideId && (
              <Badge bg="primary" className="small">
                <Star size={10} className="me-1" />
                Last Used
              </Badge>
            )}
          </div>
          
          <div className="row g-2">
            <div className="col-6">
              <div className="small">
                <strong className="text-success">${formatCurrency(selectedPayGuide.baseHourlyRate)}</strong>
                <span className="text-muted"> base rate</span>
              </div>
            </div>
            <div className="col-6">
              <div className="small">
                <strong>{selectedPayGuide.casualLoading ? formatPercentage(selectedPayGuide.casualLoading) : '0%'}</strong>
                <span className="text-muted"> casual loading</span>
              </div>
            </div>
            <div className="col-12">
              <div className="d-flex flex-wrap gap-1 mt-1">
                <Badge bg="secondary" className="small">
                  <Clock size={8} className="me-1" />
                  OT 1.5x: ${formatCurrency(new Decimal(selectedPayGuide.baseHourlyRate).mul(selectedPayGuide.overtimeRate1_5x).toString())}
                </Badge>
                <Badge bg="secondary" className="small">
                  <Clock size={8} className="me-1" />
                  OT 2x: ${formatCurrency(new Decimal(selectedPayGuide.baseHourlyRate).mul(selectedPayGuide.overtimeRate2x).toString())}
                </Badge>
                <Badge bg="info" className="small">
                  Custom penalties managed separately
                </Badge>
              </div>
            </div>
          </div>
          
          {selectedPayGuide.effectiveTo && (
            <div className="mt-2">
              <small className="text-warning">
                <Info size={10} className="me-1" />
                Expires: {new Date(selectedPayGuide.effectiveTo).toLocaleDateString()}
              </small>
            </div>
          )}
        </div>
      )}
      
      <Form.Text className="text-muted d-flex align-items-center">
        <Info size={12} className="me-1" />
        {lastUsedPayGuideId && selectedPayGuideId === lastUsedPayGuideId 
          ? 'Using your last selected pay guide'
          : 'Selection will be remembered for next time'
        }
      </Form.Text>
    </Form.Group>
  );
}