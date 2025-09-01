'use client';

import { useMemo } from 'react';
import { Row, Col, Button } from 'react-bootstrap';
import CalendarDateCell from './calendar-date-cell';
import CalendarShiftCard from './calendar-shift-card';
import { CalendarView } from './shift-calendar';
import { ShiftForDisplay } from '@/types';
import { useSettings } from '@/contexts/settings-context';

interface CalendarGridProps {
  currentDate: Date;
  view: CalendarView;
  shiftsByDate: Record<string, ShiftForDisplay[]>;
  onShiftEdit: (shift: ShiftForDisplay) => void;
  onShiftDelete: (shiftId: string) => void;
  onDateClick: (date: Date) => void;
  searchTerm?: string;
}

export default function CalendarGrid({
  currentDate,
  view,
  shiftsByDate,
  onShiftEdit,
  onShiftDelete,
  onDateClick,
  searchTerm
}: CalendarGridProps) {
  const { weekStartDay } = useSettings();

  const calendarDates = useMemo(() => {
    if (view === 'month') {
      return getMonthDates(currentDate, weekStartDay);
    } else {
      return getWeekDates(currentDate, weekStartDay);
    }
  }, [currentDate, view, weekStartDay]);

  if (view === 'week') {
    return (
      <div className="p-3">
        <Row className="g-2">
          {calendarDates.map((date, index) => {
            const dateKey = date.toISOString().split('T')[0];
            const dayShifts = shiftsByDate[dateKey] || [];
            
            return (
              <Col key={index} className="col">
                <div className="border rounded p-2" style={{ minHeight: '300px' }}>
                  {/* Day Header */}
                  <div className="text-center mb-2 pb-2 border-bottom">
                    <div className="small text-muted">
                      {date.toLocaleDateString('en-AU', { weekday: 'short' })}
                    </div>
                    <div className={`fw-bold ${isToday(date) ? 'text-primary' : ''}`}>
                      {date.getDate()}
                    </div>
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 text-muted"
                      onClick={() => onDateClick(date)}
                      title="Add shift"
                    >
                      +
                    </Button>
                  </div>

                  {/* Shifts for this day */}
                  <div className="d-flex flex-column gap-1">
                    {dayShifts.map(shift => (
                      <CalendarShiftCard
                        key={shift.id}
                        shift={shift}
                        onEdit={onShiftEdit}
                        onDelete={onShiftDelete}
                        searchTerm={searchTerm}
                        compact={true}
                      />
                    ))}
                  </div>
                </div>
              </Col>
            );
          })}
        </Row>
      </div>
    );
  }

  // Month view
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const reorderedDayNames = [
    ...dayNames.slice(weekStartDay),
    ...dayNames.slice(0, weekStartDay)
  ];
  
  return (
    <div className="p-2">
      {/* Days of week header */}
      <Row className="g-1 mb-1">
        {reorderedDayNames.map((day) => (
          <Col key={day} className="text-center">
            <small className="text-muted fw-semibold">{day}</small>
          </Col>
        ))}
      </Row>

      {/* Calendar grid */}
      {getWeeksInMonth(calendarDates).map((week, weekIndex) => (
        <Row key={weekIndex} className="g-1 mb-1">
          {week.map((date, dayIndex) => {
            const dateKey = date.toISOString().split('T')[0];
            const dayShifts = shiftsByDate[dateKey] || [];
            
            return (
              <Col key={dayIndex}>
                <CalendarDateCell
                  date={date}
                  shifts={dayShifts}
                  isCurrentMonth={date.getMonth() === currentDate.getMonth()}
                  isToday={isToday(date)}
                  onClick={onDateClick}
                  onShiftEdit={onShiftEdit}
                  onShiftDelete={onShiftDelete}
                  searchTerm={searchTerm}
                />
              </Col>
            );
          })}
        </Row>
      ))}
    </div>
  );
}

// Helper functions
function getMonthDates(date: Date, weekStartDay: number = 0): Date[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  
  // Start from the first day of the month
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  // Get the first day of the calendar week (might be from previous month)
  const startDate = new Date(firstDay);
  const dayOffset = (firstDay.getDay() - weekStartDay + 7) % 7;
  startDate.setDate(firstDay.getDate() - dayOffset);
  
  // Get the last day of the calendar week (might be from next month)
  const endDate = new Date(lastDay);
  const endDayOffset = (6 - (lastDay.getDay() - weekStartDay + 7) % 7);
  endDate.setDate(lastDay.getDate() + endDayOffset);
  
  const dates: Date[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

function getWeekDates(date: Date, weekStartDay: number = 0): Date[] {
  const startOfWeek = new Date(date);
  const dayOffset = (date.getDay() - weekStartDay + 7) % 7;
  startOfWeek.setDate(date.getDate() - dayOffset);
  
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    dates.push(day);
  }
  
  return dates;
}

function getWeeksInMonth(dates: Date[]): Date[][] {
  const weeks: Date[][] = [];
  for (let i = 0; i < dates.length; i += 7) {
    weeks.push(dates.slice(i, i + 7));
  }
  return weeks;
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}