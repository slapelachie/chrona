'use client';

import { useState } from 'react';
import { Button, Badge, OverlayTrigger, Tooltip, Dropdown } from 'react-bootstrap';
import { Plus, MoreHorizontal } from 'lucide-react';
import CalendarShiftCard from './calendar-shift-card';
import { ShiftForDisplay } from '@/types';

interface CalendarDateCellProps {
  date: Date;
  shifts: ShiftForDisplay[];
  isCurrentMonth: boolean;
  isToday: boolean;
  onClick: (date: Date) => void;
  onShiftEdit: (shift: ShiftForDisplay) => void;
  onShiftDelete: (shiftId: string) => void;
  searchTerm?: string;
}

export default function CalendarDateCell({
  date,
  shifts,
  isCurrentMonth,
  isToday,
  onClick,
  onShiftEdit,
  onShiftDelete,
  searchTerm
}: CalendarDateCellProps) {
  const [showAllShifts, setShowAllShifts] = useState(false);

  const maxVisibleShifts = 2;
  const visibleShifts = showAllShifts ? shifts : shifts.slice(0, maxVisibleShifts);
  const remainingCount = shifts.length - maxVisibleShifts;

  const handleDateClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onClick(date);
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

  const totalEarnings = shifts.reduce((sum, shift) => sum + (shift.grossPay || 0), 0);

  return (
    <div
      className={`calendar-date-cell border rounded p-1 ${
        isCurrentMonth ? '' : 'text-muted'
      } ${isToday ? 'border-primary border-2' : ''}`}
      style={{ minHeight: '100px', cursor: 'pointer' }}
      onClick={handleDateClick}
    >
      {/* Date Header */}
      <div className="d-flex justify-content-between align-items-start mb-1">
        <div className={`small fw-bold ${isToday ? 'text-primary' : ''}`}>
          {date.getDate()}
        </div>
        {shifts.length === 0 && (
          <Button
            variant="link"
            size="sm"
            className="p-0 text-muted opacity-50 hover-opacity-100"
            onClick={handleDateClick}
            title="Add shift"
            style={{ fontSize: '12px', lineHeight: 1 }}
          >
            <Plus size={12} />
          </Button>
        )}
      </div>

      {/* Shifts */}
      <div className="d-flex flex-column gap-1">
        {visibleShifts.map((shift) => (
          <CalendarShiftCard
            key={shift.id}
            shift={shift}
            onEdit={onShiftEdit}
            onDelete={onShiftDelete}
            searchTerm={searchTerm}
            compact={true}
          />
        ))}

        {/* Show more indicator */}
        {remainingCount > 0 && !showAllShifts && (
          <Button
            variant="link"
            size="sm"
            className="p-0 text-muted small"
            onClick={(e) => {
              e.stopPropagation();
              setShowAllShifts(true);
            }}
          >
            +{remainingCount} more
          </Button>
        )}

        {/* Collapse indicator */}
        {showAllShifts && shifts.length > maxVisibleShifts && (
          <Button
            variant="link"
            size="sm"
            className="p-0 text-muted small"
            onClick={(e) => {
              e.stopPropagation();
              setShowAllShifts(false);
            }}
          >
            Show less
          </Button>
        )}
      </div>

      {/* Total earnings for the day */}
      {shifts.length > 1 && totalEarnings > 0 && (
        <div className="mt-1 pt-1 border-top">
          <div className="small text-success fw-semibold">
            {new Intl.NumberFormat('en-AU', {
              style: 'currency',
              currency: 'AUD',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(totalEarnings)}
          </div>
        </div>
      )}
    </div>
  );
}