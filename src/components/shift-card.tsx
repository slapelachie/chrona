'use client';

import { Card, Badge, Dropdown, Form } from 'react-bootstrap';
import { Clock, DollarSign, MoreVertical, Edit, Trash } from 'lucide-react';
import { highlightSearchTerms } from '@/lib/utils/text-utils';
import { useBulkSelection } from '@/components/bulk-operations/bulk-selection-provider';

interface Shift {
  id: string;
  startTime: string;
  endTime: string | null;
  breakMinutes: number;
  shiftType: string;
  status: string;
  notes: string | null;
  location: string | null;
  penaltyOverrides: string | null;
  autoCalculatePenalties: boolean;
  totalMinutes: number | null;
  regularHours: number | null;
  overtimeHours: number | null;
  penaltyHours: number | null;
  grossPay: number | null;
  superannuation: number | null;
  payGuide: {
    name: string;
  };
}

interface ShiftCardProps {
  shift: Shift;
  onEdit: (shift: Shift) => void;
  onDelete: (shiftId: string) => void;
  searchTerm?: string;
}

export default function ShiftCard({ shift, onEdit, onDelete, searchTerm }: ShiftCardProps) {
  const { isShiftSelected, toggleShift } = useBulkSelection();
  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString('en-AU', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '-';
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const formatHours = (hours: number | null) => {
    if (hours === null) return '-';
    return `${hours.toFixed(1)}h`;
  };

  const getShiftTypeColor = (shiftType: string) => {
    switch (shiftType) {
      case 'REGULAR': return 'primary';
      case 'OVERTIME': return 'warning';
      case 'WEEKEND': return 'info';
      case 'PUBLIC_HOLIDAY': return 'success';
      default: return 'secondary';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'success';
      case 'SCHEDULED': return 'warning';
      case 'CANCELLED': return 'danger';
      case 'NO_SHOW': return 'dark';
      default: return 'secondary';
    }
  };

  const isSelected = isShiftSelected(shift.id);

  return (
    <Card className={`h-100 border-0 shadow-sm ${isSelected ? 'border-primary border-2' : ''}`}>
      <Card.Body className="p-3">
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div className="d-flex align-items-start">
            <Form.Check
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleShift(shift.id)}
              className="me-2"
              style={{ marginTop: '2px' }}
            />
            <div>
              <Badge bg={getShiftTypeColor(shift.shiftType)} className="mb-1">
                {shift.shiftType.toLowerCase().replace('_', ' ')}
              </Badge>
              <Badge bg={getStatusColor(shift.status)} className="ms-1">
                {shift.status.toLowerCase()}
              </Badge>
            </div>
          </div>
          <Dropdown align="end">
            <Dropdown.Toggle variant="light" size="sm" className="border-0">
              <MoreVertical size={16} />
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item onClick={() => onEdit(shift)}>
                <Edit size={14} className="me-2" />
                Edit
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item 
                className="text-danger" 
                onClick={() => onDelete(shift.id)}
              >
                <Trash size={14} className="me-2" />
                Delete
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>

        <div className="mb-3">
          <div className="fw-bold">{formatDateTime(shift.startTime)}</div>
          {shift.endTime && (
            <div className="text-muted small">
              to {formatDateTime(shift.endTime)}
            </div>
          )}
        </div>

        <div className="row small text-muted mb-2">
          <div className="col-6">
            <Clock size={12} className="me-1" />
            {shift.totalMinutes ? `${(shift.totalMinutes / 60).toFixed(1)}h` : '-'}
          </div>
          <div className="col-6">
            <DollarSign size={12} className="me-1" />
            {formatCurrency(shift.grossPay)}
          </div>
        </div>

        {(shift.regularHours || shift.overtimeHours || shift.penaltyHours) && (
          <div className="small">
            <div>Regular: {formatHours(shift.regularHours)}</div>
            {shift.overtimeHours && shift.overtimeHours > 0 && (
              <div>Overtime: {formatHours(shift.overtimeHours)}</div>
            )}
            {shift.penaltyHours && shift.penaltyHours > 0 && (
              <div>Penalty: {formatHours(shift.penaltyHours)}</div>
            )}
          </div>
        )}

        {(shift.location || shift.notes) && (
          <div className="mt-2 pt-2 border-top">
            {shift.location && (
              <div className="small text-muted mb-1">
                📍 {highlightSearchTerms(shift.location, searchTerm)}
              </div>
            )}
            {shift.notes && (
              <small className="text-muted">
                {highlightSearchTerms(shift.notes, searchTerm)}
              </small>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}