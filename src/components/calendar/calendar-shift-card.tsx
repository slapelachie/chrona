'use client';

import { Card, Badge, Dropdown, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { Clock, DollarSign, MoreVertical, Edit, Trash, MapPin } from 'lucide-react';
import { highlightSearchTerms } from '@/lib/utils/text-utils';
import { ShiftForDisplay } from '@/types';

interface CalendarShiftCardProps {
  shift: ShiftForDisplay;
  onEdit: (shift: ShiftForDisplay) => void;
  onDelete: (shiftId: string) => void;
  searchTerm?: string;
  compact?: boolean;
}

export default function CalendarShiftCard({
  shift,
  onEdit,
  onDelete,
  searchTerm,
  compact = false
}: CalendarShiftCardProps) {

  const formatTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '-';
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
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

  const shiftDuration = shift.totalMinutes ? `${(shift.totalMinutes / 60).toFixed(1)}h` : '';

  const shiftTooltip = (
    <Tooltip>
      <div>
        <strong>{formatTime(shift.startTime)} - {shift.endTime ? formatTime(shift.endTime) : '?'}</strong>
        {shift.location && <div>📍 {shift.location}</div>}
        {shift.notes && <div>💬 {shift.notes}</div>}
        <div>{formatCurrency(shift.grossPay)}</div>
      </div>
    </Tooltip>
  );

  if (compact) {
    return (
      <OverlayTrigger placement="top" overlay={shiftTooltip}>
        <Card
          className="calendar-shift-card border-0 shadow-sm mb-1"
          style={{ 
            cursor: 'pointer',
            fontSize: '11px',
            backgroundColor: `var(--bs-${getShiftTypeColor(shift.shiftType)}-subtle)`
          }}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(shift);
          }}
        >
          <Card.Body className="p-1">
            <div className="d-flex justify-content-between align-items-start">
              <div className="flex-grow-1" style={{ minWidth: 0 }}>
                <div className="d-flex align-items-center gap-1 mb-1">
                  <Badge 
                    bg={getShiftTypeColor(shift.shiftType)} 
                    className="badge-sm"
                    style={{ fontSize: '8px' }}
                  >
                    {shift.shiftType.charAt(0)}
                  </Badge>
                  <Badge 
                    bg={getStatusColor(shift.status)} 
                    className="badge-sm"
                    style={{ fontSize: '8px' }}
                  >
                    {shift.status === 'COMPLETED' ? '✓' : 
                     shift.status === 'SCHEDULED' ? '⏱' : 
                     shift.status === 'CANCELLED' ? '✗' : '?'}
                  </Badge>
                </div>
                
                <div className="fw-semibold text-truncate">
                  {formatTime(shift.startTime)}
                  {shift.endTime && ` - ${formatTime(shift.endTime)}`}
                </div>
                
                <div className="small text-muted d-flex align-items-center justify-content-between">
                  <span>{shiftDuration}</span>
                  <span>{formatCurrency(shift.grossPay)}</span>
                </div>

                {(shift.location || shift.notes) && (
                  <div className="small text-truncate" style={{ fontSize: '9px' }}>
                    {shift.location && (
                      <span className="text-muted">
                        📍 {highlightSearchTerms(shift.location, searchTerm)}
                      </span>
                    )}
                    {shift.notes && (
                      <span className="text-muted ms-1">
                        {highlightSearchTerms(shift.notes, searchTerm)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <Dropdown onClick={(e) => e.stopPropagation()}>
                <Dropdown.Toggle
                  variant="link"
                  size="sm"
                  className="p-0 border-0"
                  style={{ fontSize: '10px', width: '12px', height: '12px' }}
                >
                  <MoreVertical size={8} />
                </Dropdown.Toggle>
                
                <Dropdown.Menu>
                  <Dropdown.Item onClick={() => onEdit(shift)}>
                    <Edit size={12} className="me-2" />
                    Edit
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item 
                    className="text-danger"
                    onClick={() => onDelete(shift.id)}
                  >
                    <Trash size={12} className="me-2" />
                    Delete
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </div>
          </Card.Body>
        </Card>
      </OverlayTrigger>
    );
  }

  // Full size card for week view or detailed display
  return (
    <Card className="shift-card border shadow-sm mb-2">
      <Card.Body className="p-2">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div>
            <Badge bg={getShiftTypeColor(shift.shiftType)} className="me-1">
              {shift.shiftType.toLowerCase().replace('_', ' ')}
            </Badge>
            <Badge bg={getStatusColor(shift.status)}>
              {shift.status.toLowerCase()}
            </Badge>
          </div>
          <Dropdown>
            <Dropdown.Toggle variant="light" size="sm" className="border-0">
              <MoreVertical size={14} />
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item onClick={() => onEdit(shift)}>
                <Edit size={12} className="me-2" />
                Edit
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item 
                className="text-danger" 
                onClick={() => onDelete(shift.id)}
              >
                <Trash size={12} className="me-2" />
                Delete
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>

        <div className="mb-2">
          <div className="fw-bold small">
            {formatTime(shift.startTime)}
            {shift.endTime && ` - ${formatTime(shift.endTime)}`}
          </div>
        </div>

        <div className="small text-muted mb-2">
          <div className="d-flex justify-content-between">
            <span>
              <Clock size={10} className="me-1" />
              {shiftDuration}
            </span>
            <span>
              <DollarSign size={10} className="me-1" />
              {formatCurrency(shift.grossPay)}
            </span>
          </div>
        </div>

        {(shift.location || shift.notes) && (
          <div className="border-top pt-1">
            {shift.location && (
              <div className="small text-muted mb-1">
                <MapPin size={10} className="me-1" />
                {highlightSearchTerms(shift.location, searchTerm)}
              </div>
            )}
            {shift.notes && (
              <div className="small text-muted">
                {highlightSearchTerms(shift.notes, searchTerm)}
              </div>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}