'use client';

import { useState } from 'react';
import { Card, Badge, Button, Collapse } from 'react-bootstrap';
import { ChevronDown, ChevronUp, Clock, DollarSign, Calendar } from 'lucide-react';
import { PayPeriodGroup } from '@/types';

interface ShiftGroupHeaderProps {
  payPeriod: PayPeriodGroup;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

export default function ShiftGroupHeader({ 
  payPeriod, 
  children, 
  defaultExpanded = true 
}: ShiftGroupHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate).toLocaleDateString('en-AU', {
      month: 'short',
      day: 'numeric'
    });
    const end = new Date(endDate).toLocaleDateString('en-AU', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    return `${start} - ${end}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open': return 'primary';
      case 'closed': return 'success';
      case 'paid': return 'success';
      case 'pending': return 'warning';
      default: return 'secondary';
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open': return 'Open';
      case 'closed': return 'Closed';
      case 'paid': return 'Paid';
      case 'pending': return 'Pending';
      default: return status;
    }
  };

  return (
    <div className="mb-3">
      <Card className="border-0 shadow-sm">
        <Card.Header 
          className="bg-light border-0 py-2 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ cursor: 'pointer' }}
        >
          <div className="d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center">
              <Button
                variant="link"
                size="sm"
                className="p-0 me-2 text-dark"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
              >
                {isExpanded ? (
                  <ChevronUp size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </Button>

              <div>
                <div className="d-flex align-items-center mb-1">
                  <Calendar size={14} className="me-2 text-muted" />
                  <h6 className="mb-0 fw-bold">
                    {formatDateRange(payPeriod.startDate, payPeriod.endDate)}
                  </h6>
                  <Badge 
                    bg={getStatusColor(payPeriod.status)} 
                    className="ms-2"
                  >
                    {getStatusText(payPeriod.status)}
                  </Badge>
                </div>
                
                <div className="small text-muted">
                  Pay Period • {payPeriod.summary.shiftCount} shift{payPeriod.summary.shiftCount !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            <div className="text-end">
              <div className="d-flex align-items-center justify-content-end mb-1">
                <Clock size={14} className="me-1 text-muted" />
                <span className="small fw-medium">
                  {payPeriod.summary.totalHours.toFixed(1)}h
                </span>
              </div>
              <div className="d-flex align-items-center justify-content-end">
                <DollarSign size={14} className="me-1 text-muted" />
                <span className="small fw-bold text-success">
                  {formatCurrency(payPeriod.summary.totalPay)}
                </span>
              </div>
            </div>
          </div>
        </Card.Header>

        <Collapse in={isExpanded}>
          <div>
            <Card.Body className="p-0">
              {children}
            </Card.Body>
          </div>
        </Collapse>
      </Card>
    </div>
  );
}