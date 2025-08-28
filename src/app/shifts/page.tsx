'use client';

import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Badge, Alert, Dropdown } from 'react-bootstrap';
import { CalendarPlus, Clock, DollarSign, MoreVertical, Edit, Trash, Calendar } from 'lucide-react';
import EnhancedShiftForm from '@/components/enhanced-shift-form';

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

interface PenaltyOverride {
  evening?: boolean | null;
  night?: boolean | null;
  weekend?: boolean | null;
  publicHoliday?: boolean | null;
  overrideReason?: string;
}

interface ShiftFormData {
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  notes: string;
  location: string;
  shiftType: 'REGULAR' | 'OVERTIME' | 'WEEKEND' | 'PUBLIC_HOLIDAY';
  payGuideId?: string;
  penaltyOverrides?: PenaltyOverride;
  autoCalculatePenalties: boolean;
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/shifts?limit=50');
      
      if (!response.ok) {
        throw new Error('Failed to fetch shifts');
      }
      
      const data = await response.json();
      setShifts(data.shifts);
    } catch (error) {
      console.error('Error fetching shifts:', error);
      setError('Failed to load shifts');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitShift = async (formData: ShiftFormData) => {
    try {
      setFormLoading(true);
      setError(null);
      
      // Combine date and time into ISO strings
      const startTime = new Date(`${formData.date}T${formData.startTime}`).toISOString();
      const endTime = new Date(`${formData.date}T${formData.endTime}`).toISOString();
      
      const shiftData = {
        startTime,
        endTime,
        breakMinutes: formData.breakMinutes,
        shiftType: formData.shiftType,
        notes: formData.notes || undefined,
        location: formData.location || undefined,
        payGuideId: formData.payGuideId,
        penaltyOverrides: formData.penaltyOverrides,
        autoCalculatePenalties: formData.autoCalculatePenalties ?? true
      };

      const response = editingShift
        ? await fetch(`/api/shifts/${editingShift.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(shiftData)
          })
        : await fetch('/api/shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(shiftData)
          });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save shift');
      }

      setSuccess(editingShift ? 'Shift updated successfully!' : 'Shift added successfully!');
      setShowForm(false);
      setEditingShift(null);
      fetchShifts();
    } catch (error) {
      console.error('Error saving shift:', error);
      setError(error instanceof Error ? error.message : 'Failed to save shift');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditShift = (shift: Shift) => {
    setEditingShift(shift);
    setShowForm(true);
  };

  const handleDeleteShift = async (shiftId: string) => {
    if (!confirm('Are you sure you want to delete this shift?')) {
      return;
    }

    try {
      const response = await fetch(`/api/shifts/${shiftId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete shift');
      }

      setSuccess('Shift deleted successfully!');
      fetchShifts();
    } catch (error) {
      console.error('Error deleting shift:', error);
      setError('Failed to delete shift');
    }
  };

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

  if (loading) {
    return (
      <Container fluid className="py-4">
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4">
      {/* Page Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h1 className="h3 mb-1">Shifts</h1>
              <p className="text-muted mb-0">
                Manage your work shifts and track hours
              </p>
            </div>
            <Button 
              variant="primary" 
              onClick={() => {
                setEditingShift(null);
                setShowForm(true);
              }}
            >
              <CalendarPlus size={16} className="me-1" />
              Add Shift
            </Button>
          </div>
        </Col>
      </Row>

      {/* Alerts */}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Shifts List */}
      <Row>
        <Col>
          {shifts.length === 0 ? (
            <Card className="text-center py-5">
              <Card.Body>
                <Calendar size={48} className="text-muted mb-3" />
                <h5 className="text-muted">No shifts found</h5>
                <p className="text-muted mb-4">Start by adding your first shift</p>
                <Button 
                  variant="primary" 
                  onClick={() => {
                    setEditingShift(null);
                    setShowForm(true);
                  }}
                >
                  <CalendarPlus size={16} className="me-1" />
                  Add Your First Shift
                </Button>
              </Card.Body>
            </Card>
          ) : (
            <div className="row">
              {shifts.map((shift) => (
                <div key={shift.id} className="col-12 col-lg-6 col-xl-4 mb-3">
                  <Card className="h-100">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div>
                          <Badge bg={getShiftTypeColor(shift.shiftType)} className="mb-1">
                            {shift.shiftType.toLowerCase().replace('_', ' ')}
                          </Badge>
                          <Badge bg={getStatusColor(shift.status)} className="ms-1">
                            {shift.status.toLowerCase()}
                          </Badge>
                        </div>
                        <Dropdown align="end">
                          <Dropdown.Toggle variant="light" size="sm" className="border-0">
                            <MoreVertical size={16} />
                          </Dropdown.Toggle>
                          <Dropdown.Menu>
                            <Dropdown.Item onClick={() => handleEditShift(shift)}>
                              <Edit size={14} className="me-2" />
                              Edit
                            </Dropdown.Item>
                            <Dropdown.Divider />
                            <Dropdown.Item 
                              className="text-danger" 
                              onClick={() => handleDeleteShift(shift.id)}
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
                            <div className="small text-muted mb-1">📍 {shift.location}</div>
                          )}
                          {shift.notes && (
                            <small className="text-muted">{shift.notes}</small>
                          )}
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </Col>
      </Row>

      {/* Enhanced Shift Form Modal */}
      <EnhancedShiftForm
        show={showForm}
        onHide={() => {
          setShowForm(false);
          setEditingShift(null);
        }}
        onSubmit={handleSubmitShift}
        initialData={editingShift ? {
          date: new Date(editingShift.startTime).toISOString().split('T')[0],
          startTime: new Date(editingShift.startTime).toTimeString().slice(0, 5),
          endTime: editingShift.endTime ? new Date(editingShift.endTime).toTimeString().slice(0, 5) : '',
          breakMinutes: editingShift.breakMinutes,
          notes: editingShift.notes || '',
          location: editingShift.location || '',
          shiftType: editingShift.shiftType as 'REGULAR' | 'OVERTIME' | 'WEEKEND' | 'PUBLIC_HOLIDAY',
          penaltyOverrides: editingShift.penaltyOverrides ? JSON.parse(editingShift.penaltyOverrides) : {},
          autoCalculatePenalties: editingShift.autoCalculatePenalties ?? true
        } : undefined}
        isEdit={!!editingShift}
        loading={formLoading}
      />
    </Container>
  );
}