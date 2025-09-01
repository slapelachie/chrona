'use client';

import { Button, ButtonGroup, Dropdown } from 'react-bootstrap';
import { ChevronLeft, ChevronRight, Calendar, Grid, List } from 'lucide-react';
import { CalendarView } from './shift-calendar';

interface CalendarNavigationProps {
  currentDate: Date;
  view: CalendarView;
  onDateChange: (date: Date) => void;
  onViewChange: (view: CalendarView) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}

export default function CalendarNavigation({
  currentDate,
  view,
  onDateChange,
  onViewChange,
  onPrevious,
  onNext,
  onToday
}: CalendarNavigationProps) {
  
  const formatCurrentPeriod = () => {
    if (view === 'month') {
      return currentDate.toLocaleDateString('en-AU', {
        month: 'long',
        year: 'numeric'
      });
    } else {
      // Week view - show the week range
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      
      const startMonth = startOfWeek.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
      const endMonth = endOfWeek.toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' });
      
      return `${startMonth} - ${endMonth}`;
    }
  };

  return (
    <div className="d-flex align-items-center gap-2">
      {/* View Toggle */}
      <ButtonGroup size="sm">
        <Button
          variant={view === 'month' ? 'primary' : 'outline-primary'}
          onClick={() => onViewChange('month')}
          title="Month View"
        >
          <Grid size={14} />
          <span className="d-none d-md-inline ms-1">Month</span>
        </Button>
        <Button
          variant={view === 'week' ? 'primary' : 'outline-primary'}
          onClick={() => onViewChange('week')}
          title="Week View"
        >
          <List size={14} />
          <span className="d-none d-md-inline ms-1">Week</span>
        </Button>
      </ButtonGroup>

      {/* Navigation Controls */}
      <div className="d-flex align-items-center">
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={onPrevious}
          title={`Previous ${view}`}
        >
          <ChevronLeft size={14} />
        </Button>

        <div className="mx-3 text-center" style={{ minWidth: '140px' }}>
          <div className="fw-semibold">{formatCurrentPeriod()}</div>
        </div>

        <Button
          variant="outline-secondary"
          size="sm"
          onClick={onNext}
          title={`Next ${view}`}
        >
          <ChevronRight size={14} />
        </Button>
      </div>

      {/* Today Button */}
      <Button
        variant="outline-primary"
        size="sm"
        onClick={onToday}
        title="Go to today"
      >
        <Calendar size={14} />
        <span className="d-none d-md-inline ms-1">Today</span>
      </Button>

      {/* Date Picker Dropdown */}
      <Dropdown>
        <Dropdown.Toggle variant="outline-secondary" size="sm" id="date-picker">
          <Calendar size={14} />
        </Dropdown.Toggle>

        <Dropdown.Menu>
          <div className="p-2" style={{ minWidth: '250px' }}>
            <div className="text-center">
              <input
                type="month"
                className="form-control form-control-sm"
                value={`${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`}
                onChange={(e) => {
                  const [year, month] = e.target.value.split('-');
                  const newDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                  onDateChange(newDate);
                }}
              />
            </div>
          </div>
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
}