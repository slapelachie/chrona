'use client';

import { useState, useMemo } from 'react';
import { Card, Row, Col, Button, Badge } from 'react-bootstrap';
import { ChevronLeft, ChevronRight, Calendar, Plus } from 'lucide-react';
import CalendarGrid from './calendar-grid';
import CalendarNavigation from './calendar-navigation';
import { PayPeriodGroup, ShiftForDisplay } from '@/types';

export type CalendarView = 'month' | 'week';

interface ShiftCalendarProps {
  payPeriods: PayPeriodGroup[];
  loading?: boolean;
  onShiftEdit: (shift: ShiftForDisplay) => void;
  onShiftDelete: (shiftId: string) => void;
  onAddShift: (date?: Date) => void;
  searchTerm?: string;
  className?: string;
}

export default function ShiftCalendar({
  payPeriods,
  loading = false,
  onShiftEdit,
  onShiftDelete,
  onAddShift,
  searchTerm,
  className = ''
}: ShiftCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('month');

  // Flatten all shifts from pay periods into a single array with dates as keys
  const shiftsByDate = useMemo(() => {
    const shifts: Record<string, ShiftForDisplay[]> = {};
    
    payPeriods.forEach(period => {
      period.shifts.forEach(shift => {
        const shiftDate = new Date(shift.startTime);
        const dateKey = shiftDate.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        if (!shifts[dateKey]) {
          shifts[dateKey] = [];
        }
        shifts[dateKey].push(shift);
      });
    });

    return shifts;
  }, [payPeriods]);

  const handleDateChange = (date: Date) => {
    setCurrentDate(date);
  };

  const handleViewChange = (newView: CalendarView) => {
    setView(newView);
  };

  const handlePrevious = () => {
    const newDate = new Date(currentDate);
    if (view === 'month') {
      newDate.setMonth(currentDate.getMonth() - 1);
    } else {
      newDate.setDate(currentDate.getDate() - 7);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (view === 'month') {
      newDate.setMonth(currentDate.getMonth() + 1);
    } else {
      newDate.setDate(currentDate.getDate() + 7);
    }
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDateClick = (date: Date) => {
    onAddShift(date);
  };

  if (loading) {
    return (
      <div className={`d-flex justify-content-center align-items-center ${className}`} 
           style={{ minHeight: '400px' }}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status">
            <span className="visually-hidden">Loading calendar...</span>
          </div>
          <p className="text-muted">Loading your shifts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Card className="border-0 shadow-sm">
        <Card.Header className="border-bottom">
          <Row className="align-items-center">
            <Col>
              <div className="d-flex align-items-center">
                <Calendar size={20} className="text-primary me-2" />
                <h5 className="mb-0">Calendar View</h5>
              </div>
            </Col>
            <Col xs="auto">
              <CalendarNavigation
                currentDate={currentDate}
                view={view}
                onDateChange={handleDateChange}
                onViewChange={handleViewChange}
                onPrevious={handlePrevious}
                onNext={handleNext}
                onToday={handleToday}
              />
            </Col>
          </Row>
        </Card.Header>

        <Card.Body className="p-0">
          <CalendarGrid
            currentDate={currentDate}
            view={view}
            shiftsByDate={shiftsByDate}
            onShiftEdit={onShiftEdit}
            onShiftDelete={onShiftDelete}
            onDateClick={handleDateClick}
            searchTerm={searchTerm}
          />
        </Card.Body>
      </Card>
    </div>
  );
}