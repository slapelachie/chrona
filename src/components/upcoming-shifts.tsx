'use client';

import { useState, useEffect } from 'react';
import { Card, Badge, Button } from 'react-bootstrap';
import { Calendar, Clock, DollarSign, MapPin, Edit3 } from 'lucide-react';

interface UpcomingShift {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  duration: number; // in hours
  estimatedPay: number;
  shiftType: 'regular' | 'overtime' | 'penalty' | 'weekend' | 'public_holiday';
  location?: string;
  notes?: string;
}

export default function UpcomingShifts() {
  const [upcomingShifts, setUpcomingShifts] = useState<UpcomingShift[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUpcomingShifts();
  }, []);

  const fetchUpcomingShifts = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/upcoming-shifts');
      
      if (!response.ok) {
        throw new Error('Failed to fetch upcoming shifts data');
      }
      
      const data = await response.json();
      
      // Convert date strings back to Date objects
      const shiftsWithDates = data.map((shift: UpcomingShift) => ({
        ...shift,
        date: new Date(shift.date)
      }));
      
      setUpcomingShifts(shiftsWithDates);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching upcoming shifts:', error);
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-AU', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    }
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getShiftTypeBadge = (shiftType: string) => {
    switch (shiftType) {
      case 'regular':
        return <Badge bg="primary">Regular</Badge>;
      case 'overtime':
        return <Badge bg="warning">Overtime</Badge>;
      case 'penalty':
        return <Badge bg="info">Penalty</Badge>;
      case 'weekend':
        return <Badge bg="secondary">Weekend</Badge>;
      case 'public_holiday':
        return <Badge bg="success">Public Holiday</Badge>;
      default:
        return <Badge bg="light" text="dark">Unknown</Badge>;
    }
  };

  const getDaysUntilShift = (date: Date) => {
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getTotalUpcomingEarnings = () => {
    return upcomingShifts.reduce((total, shift) => total + shift.estimatedPay, 0);
  };

  if (loading) {
    return (
      <Card className="shadow-sm h-100">
        <Card.Body className="d-flex justify-content-center align-items-center" style={{ minHeight: '250px' }}>
          <div className="spinner-border spinner-border-sm text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm h-100">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="card-title mb-0 d-flex align-items-center">
            <Calendar size={20} className="me-2 text-primary" />
            Upcoming Shifts
          </h5>
          {upcomingShifts.length > 0 && (
            <div className="text-end">
              <div className="fw-bold text-success">{formatCurrency(getTotalUpcomingEarnings())}</div>
              <small className="text-muted">Total estimated</small>
            </div>
          )}
        </div>

        {upcomingShifts.length === 0 ? (
          <div className="text-center text-muted py-4">
            <Calendar size={48} className="mb-3 opacity-25" />
            <p>No upcoming shifts scheduled</p>
            <Button variant="outline-primary" size="sm">
              Add Shift
            </Button>
          </div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {upcomingShifts.slice(0, 4).map((shift) => (
              <div key={shift.id} className="border rounded p-3 bg-light">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <div className="fw-bold d-flex align-items-center">
                      <span className="me-2">{formatDate(shift.date)}</span>
                      {getShiftTypeBadge(shift.shiftType)}
                    </div>
                    <div className="d-flex align-items-center text-muted small mt-1">
                      <Clock size={14} className="me-1" />
                      {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                      <span className="ms-2">({shift.duration}h)</span>
                    </div>
                  </div>
                  
                  <div className="text-end">
                    <div className="fw-bold text-success">{formatCurrency(shift.estimatedPay)}</div>
                    <Button variant="outline-secondary" size="sm" className="mt-1">
                      <Edit3 size={12} />
                    </Button>
                  </div>
                </div>

                {shift.location && (
                  <div className="d-flex align-items-center text-muted small mb-2">
                    <MapPin size={14} className="me-1" />
                    {shift.location}
                  </div>
                )}

                {shift.notes && (
                  <div className="small text-muted">
                    <em>&quot;{shift.notes}&quot;</em>
                  </div>
                )}

                {/* Days until shift indicator */}
                <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                  <small className="text-muted">
                    {getDaysUntilShift(shift.date) === 0 && "Today"}
                    {getDaysUntilShift(shift.date) === 1 && "Tomorrow"}
                    {getDaysUntilShift(shift.date) > 1 && `In ${getDaysUntilShift(shift.date)} days`}
                  </small>
                  
                  <div className="d-flex align-items-center">
                    <DollarSign size={14} className="text-success me-1" />
                    <small className="text-success fw-bold">
                      {(shift.estimatedPay / shift.duration).toFixed(2)}/hr
                    </small>
                  </div>
                </div>
              </div>
            ))}

            {upcomingShifts.length > 4 && (
              <div className="text-center pt-2">
                <Button variant="outline-primary" size="sm">
                  View All Shifts ({upcomingShifts.length - 4} more)
                </Button>
              </div>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}