'use client';

import { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Alert, Spinner } from 'react-bootstrap';
import { CalendarPlus, Calendar } from 'lucide-react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import EnhancedShiftForm from '@/components/enhanced-shift-form';
import ShiftFilters from '@/components/shift-filters';
import ShiftGroupHeader from '@/components/shift-group-header';
import ShiftSummaryCards from '@/components/shift-summary-cards';
import InfiniteScrollContainer from '@/components/infinite-scroll-container';
import ShiftCard from '@/components/shift-card';
import { PayPeriodGroup, ShiftFilters as ShiftFiltersType } from '@/types';

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
  const [payPeriods, setPayPeriods] = useState<PayPeriodGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  // Filter state from URL params
  const [filters, setFilters] = useState<ShiftFiltersType>({
    status: searchParams.get('status') || undefined,
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
    payPeriodId: searchParams.get('payPeriodId') || undefined,
    location: searchParams.get('location') || undefined,
    shiftType: searchParams.get('shiftType') || undefined,
  });

  // Update URL when filters change
  const updateURL = useCallback((newFilters: ShiftFiltersType) => {
    const params = new URLSearchParams();
    
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
    
    const newURL = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newURL);
  }, [pathname, router]);

  const buildApiURL = (cursor?: string) => {
    const params = new URLSearchParams({
      groupByPayPeriod: 'true',
      pageSize: '20'
    });
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
    
    if (cursor) {
      params.set('cursor', cursor);
    }
    
    return `/api/shifts?${params.toString()}`;
  };

  const fetchShifts = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setPayPeriods([]);
        setNextCursor(null);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }
      
      const url = buildApiURL(reset ? undefined : (nextCursor || undefined));
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch shifts');
      }
      
      const data = await response.json();
      
      if (reset) {
        setPayPeriods(data.payPeriods || []);
      } else {
        setPayPeriods(prev => [...prev, ...(data.payPeriods || [])]);
      }
      
      setNextCursor(data.pagination?.nextCursor || null);
      setHasMore(data.pagination?.hasMore || false);
    } catch (error) {
      console.error('Error fetching shifts:', error);
      setError('Failed to load shifts');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore && nextCursor) {
      fetchShifts(false);
    }
  }, [loadingMore, hasMore, nextCursor]);

  // Fetch shifts when filters change
  useEffect(() => {
    fetchShifts(true);
  }, [filters]);

  const handleFiltersChange = (newFilters: ShiftFiltersType) => {
    setFilters(newFilters);
    updateURL(newFilters);
  };

  const handleResetFilters = () => {
    const emptyFilters: ShiftFiltersType = {};
    setFilters(emptyFilters);
    updateURL(emptyFilters);
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
      fetchShifts(true); // Reset and reload
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
      fetchShifts(true); // Reset and reload
    } catch (error) {
      console.error('Error deleting shift:', error);
      setError('Failed to delete shift');
    }
  };

  if (loading) {
    return (
      <Container fluid className="py-4">
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
          <Spinner animation="border" variant="primary">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
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

      {/* Summary Cards */}
      <ShiftSummaryCards 
        payPeriods={payPeriods} 
        loading={loading}
        className="mb-4"
      />

      {/* Filters */}
      <ShiftFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onReset={handleResetFilters}
        className="mb-4"
      />

      {/* Shifts Content */}
      <Row>
        <Col>
          {payPeriods.length === 0 && !loading ? (
            <Card className="text-center py-5 border-0 shadow-sm">
              <Card.Body>
                <Calendar size={48} className="text-muted mb-3" />
                <h5 className="text-muted">No shifts found</h5>
                <p className="text-muted mb-4">
                  {Object.values(filters).some(v => v) 
                    ? 'Try adjusting your filters or add a new shift'
                    : 'Start by adding your first shift'
                  }
                </p>
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
            <InfiniteScrollContainer
              loading={loadingMore}
              hasMore={hasMore}
              onLoadMore={handleLoadMore}
            >
              {payPeriods.map((payPeriod) => (
                <ShiftGroupHeader
                  key={payPeriod.id}
                  payPeriod={payPeriod}
                  defaultExpanded={true}
                >
                  <div className="p-3">
                    <Row className="g-3">
                      {payPeriod.shifts.map((shift) => (
                        <Col key={shift.id} xs={12} lg={6} xl={4}>
                          <ShiftCard
                            shift={shift}
                            onEdit={handleEditShift}
                            onDelete={handleDeleteShift}
                          />
                        </Col>
                      ))}
                    </Row>
                  </div>
                </ShiftGroupHeader>
              ))}
            </InfiniteScrollContainer>
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