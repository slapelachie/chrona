'use client';

import { useState, useEffect } from 'react';
import { Card, Form, Row, Col, Button, Collapse, Badge } from 'react-bootstrap';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { ShiftFilters as ShiftFiltersType, PayPeriodSummaryItem } from '@/types';
import SearchBar from '@/components/search/search-bar';

interface ShiftFiltersProps {
  filters: ShiftFiltersType;
  onFiltersChange: (filters: ShiftFiltersType) => void;
  onReset: () => void;
  className?: string;
}

interface PayPeriod {
  id: string;
  startDate: string;
  endDate: string;
  summary: {
    shiftCount: number;
  };
}

export default function ShiftFilters({ 
  filters, 
  onFiltersChange, 
  onReset,
  className = ''
}: ShiftFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [payPeriods, setPayPeriods] = useState<PayPeriodSummaryItem[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Load filter options
  useEffect(() => {
    const loadFilterOptions = async () => {
      setLoading(true);
      try {
        // Load pay periods
        const payPeriodsResponse = await fetch('/api/pay-periods?includeEmpty=false&limit=12');
        if (payPeriodsResponse.ok) {
          const data = await payPeriodsResponse.json();
          setPayPeriods(data.payPeriods);
        }

        // Load distinct locations from recent shifts
        const shiftsResponse = await fetch('/api/shifts?limit=100');
        if (shiftsResponse.ok) {
          const data = await shiftsResponse.json();
          const distinctLocations = [...new Set(
            data.shifts
              .map((shift: any) => shift.location)
              .filter((location: string | null) => location)
          )] as string[];
          setLocations(distinctLocations);
        }
      } catch (error) {
        console.error('Error loading filter options:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFilterOptions();
  }, []);

  const handleFilterChange = (key: keyof ShiftFiltersType, value: string | undefined) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined
    });
  };

  const formatDateForInput = (dateString: string | undefined) => {
    if (!dateString) return '';
    return new Date(dateString).toISOString().split('T')[0];
  };

  const formatPayPeriodLabel = (period: PayPeriodSummaryItem) => {
    const start = new Date(period.startDate).toLocaleDateString('en-AU', { 
      month: 'short', 
      day: 'numeric' 
    });
    const end = new Date(period.endDate).toLocaleDateString('en-AU', { 
      month: 'short', 
      day: 'numeric' 
    });
    return `${start} - ${end} (${period.summary.shiftCount} shifts)`;
  };

  const getActiveFilterCount = () => {
    return Object.values(filters).filter(value => value !== undefined && value !== '').length;
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <div className={className}>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <Button
          variant="outline-primary"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="d-flex align-items-center"
        >
          <Filter size={16} className="me-2" />
          Filters
          {activeFilterCount > 0 && (
            <Badge bg="primary" className="ms-2">
              {activeFilterCount}
            </Badge>
          )}
          {isOpen ? (
            <ChevronUp size={16} className="ms-2" />
          ) : (
            <ChevronDown size={16} className="ms-2" />
          )}
        </Button>
        
        {activeFilterCount > 0 && (
          <Button
            variant="link"
            size="sm"
            onClick={onReset}
            className="text-muted p-0"
          >
            <X size={16} className="me-1" />
            Clear all
          </Button>
        )}
      </div>

      <Collapse in={isOpen}>
        <Card className="border-0 shadow-sm">
          <Card.Body className="py-3">
            <Form>
              {/* Search Bar */}
              <Row className="g-3 mb-3">
                <Col xs={12}>
                  <SearchBar
                    value={filters.search || ''}
                    onChange={(value) => handleFilterChange('search', value)}
                    onClear={() => handleFilterChange('search', undefined)}
                    placeholder="Search shifts by location, notes, or type..."
                  />
                </Col>
              </Row>
              
              <Row className="g-3">
                {/* Date Range */}
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="small text-muted">Start Date</Form.Label>
                    <Form.Control
                      type="date"
                      size="sm"
                      value={formatDateForInput(filters.startDate)}
                      onChange={(e) => handleFilterChange('startDate', 
                        e.target.value ? new Date(e.target.value).toISOString() : undefined
                      )}
                    />
                  </Form.Group>
                </Col>
                
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="small text-muted">End Date</Form.Label>
                    <Form.Control
                      type="date"
                      size="sm"
                      value={formatDateForInput(filters.endDate)}
                      onChange={(e) => handleFilterChange('endDate', 
                        e.target.value ? new Date(e.target.value).toISOString() : undefined
                      )}
                    />
                  </Form.Group>
                </Col>

                {/* Status */}
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="small text-muted">Status</Form.Label>
                    <Form.Select
                      size="sm"
                      value={filters.status || ''}
                      onChange={(e) => handleFilterChange('status', e.target.value)}
                    >
                      <option value="">All statuses</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="SCHEDULED">Scheduled</option>
                      <option value="CANCELLED">Cancelled</option>
                      <option value="NO_SHOW">No Show</option>
                    </Form.Select>
                  </Form.Group>
                </Col>

                {/* Shift Type */}
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="small text-muted">Shift Type</Form.Label>
                    <Form.Select
                      size="sm"
                      value={filters.shiftType || ''}
                      onChange={(e) => handleFilterChange('shiftType', e.target.value)}
                    >
                      <option value="">All types</option>
                      <option value="REGULAR">Regular</option>
                      <option value="OVERTIME">Overtime</option>
                      <option value="WEEKEND">Weekend</option>
                      <option value="PUBLIC_HOLIDAY">Public Holiday</option>
                    </Form.Select>
                  </Form.Group>
                </Col>

                {/* Pay Period */}
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="small text-muted">Pay Period</Form.Label>
                    <Form.Select
                      size="sm"
                      value={filters.payPeriodId || ''}
                      onChange={(e) => handleFilterChange('payPeriodId', e.target.value)}
                      disabled={loading}
                    >
                      <option value="">All pay periods</option>
                      {payPeriods.map((period) => (
                        <option key={period.id} value={period.id}>
                          {formatPayPeriodLabel(period)}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>

                {/* Location */}
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="small text-muted">Location</Form.Label>
                    <Form.Select
                      size="sm"
                      value={filters.location || ''}
                      onChange={(e) => handleFilterChange('location', e.target.value)}
                      disabled={loading}
                    >
                      <option value="">All locations</option>
                      {locations.map((location) => (
                        <option key={location} value={location}>
                          {location}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              {/* Quick Filters */}
              <div className="mt-3 pt-3 border-top">
                <div className="small text-muted mb-2">Quick Filters:</div>
                <div className="d-flex flex-wrap gap-2">
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      const startOfWeek = new Date(today);
                      startOfWeek.setDate(today.getDate() - today.getDay());
                      
                      onFiltersChange({
                        ...filters,
                        startDate: startOfWeek.toISOString(),
                        endDate: undefined
                      });
                    }}
                  >
                    This Week
                  </Button>
                  
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      const lastWeek = new Date(today);
                      lastWeek.setDate(today.getDate() - 7);
                      
                      onFiltersChange({
                        ...filters,
                        startDate: lastWeek.toISOString(),
                        endDate: today.toISOString()
                      });
                    }}
                  >
                    Last 7 Days
                  </Button>

                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                      
                      onFiltersChange({
                        ...filters,
                        startDate: startOfMonth.toISOString(),
                        endDate: undefined
                      });
                    }}
                  >
                    This Month
                  </Button>

                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => {
                      onFiltersChange({
                        ...filters,
                        status: 'COMPLETED'
                      });
                    }}
                  >
                    Completed Only
                  </Button>
                </div>
              </div>
            </Form>
          </Card.Body>
        </Card>
      </Collapse>
    </div>
  );
}