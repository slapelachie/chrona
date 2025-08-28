'use client';

import { useState } from 'react';
import { Form, Button, Modal, Alert, InputGroup } from 'react-bootstrap';
import { Calendar, Clock, FileText, AlertCircle, DollarSign } from 'lucide-react';

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

interface ShiftFormProps {
  show: boolean;
  onHide: () => void;
  onSubmit: (data: ShiftFormData) => void;
  initialData?: Partial<ShiftFormData>;
  isEdit?: boolean;
  loading?: boolean;
}

interface ShiftPreview {
  duration: number;
  estimatedPay: number;
  hasWarnings: boolean;
  warnings: string[];
  appliedPenalties: string[];
  breakdown?: {
    regularPay: number;
    overtimePay: number;
    penaltyPay: number;
    casualLoading: number;
  };
}

export default function ShiftForm({ 
  show, 
  onHide, 
  onSubmit, 
  initialData, 
  isEdit = false,
  loading = false 
}: ShiftFormProps) {
  const [formData, setFormData] = useState<ShiftFormData>({
    date: initialData?.date || new Date().toISOString().split('T')[0],
    startTime: initialData?.startTime || '09:00',
    endTime: initialData?.endTime || '17:00',
    breakMinutes: initialData?.breakMinutes || 30,
    notes: initialData?.notes || '',
    location: initialData?.location || '',
    shiftType: initialData?.shiftType || 'REGULAR',
    payGuideId: initialData?.payGuideId,
    penaltyOverrides: initialData?.penaltyOverrides || {},
    autoCalculatePenalties: initialData?.autoCalculatePenalties ?? true
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<ShiftPreview | null>(null);

  // Calculate shift preview when form changes
  const calculateShiftPreview = (data: ShiftFormData): ShiftPreview => {
    // Create dates with explicit timezone handling to match backend
    const startDateTime = new Date(`${data.date}T${data.startTime}:00`);
    const endDateTime = new Date(`${data.date}T${data.endTime}:00`);
    
    // Handle overnight shifts
    if (endDateTime <= startDateTime) {
      endDateTime.setDate(endDateTime.getDate() + 1);
    }

    const totalMinutes = Math.floor((endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60));
    const workingMinutes = Math.max(0, totalMinutes - data.breakMinutes);
    const duration = workingMinutes / 60;

    // Basic pay estimation (would use actual PayCalculator in real app)
    const baseRate = 25.00; // Mock base rate
    let estimatedPay = duration * baseRate;
    
    // Apply casual loading
    estimatedPay *= 1.25;
    
    // Apply penalty rates based on shift type
    switch (data.shiftType) {
      case 'WEEKEND':
        estimatedPay *= 1.25; // Saturday/Sunday penalty
        break;
      case 'PUBLIC_HOLIDAY':
        estimatedPay *= 2.5; // Public holiday rate
        break;
      case 'OVERTIME':
        // Apply overtime after 8 hours
        if (duration > 8) {
          const regularPay = 8 * baseRate * 1.25;
          const overtimePay = (duration - 8) * baseRate * 1.5 * 1.25;
          estimatedPay = regularPay + overtimePay;
        }
        break;
    }

    // Generate warnings
    const warnings: string[] = [];
    
    if (duration < 3) {
      warnings.push('Very short shift (less than 3 hours)');
    }
    
    if (duration > 12) {
      warnings.push('Very long shift (more than 12 hours)');
    }
    
    if (duration > 5 && data.breakMinutes < 30) {
      warnings.push('Shifts over 5 hours should have at least 30 minutes break');
    }
    
    if (duration > 10 && data.breakMinutes < 60) {
      warnings.push('Shifts over 10 hours should have at least 60 minutes break');
    }

    // Check if it's actually a weekend
    const dayOfWeek = startDateTime.getDay();
    if ((dayOfWeek === 0 || dayOfWeek === 6) && data.shiftType === 'REGULAR') {
      warnings.push('This appears to be a weekend - consider changing shift type');
    }

    return {
      duration: Math.round(duration * 100) / 100,
      estimatedPay: Math.round(estimatedPay * 100) / 100,
      hasWarnings: warnings.length > 0,
      warnings,
      appliedPenalties: [] // For compatibility
    };
  };

  const handleInputChange = (field: keyof ShiftFormData, value: string | number) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    
    // Clear related errors
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
    
    // Update preview
    setPreview(calculateShiftPreview(newData));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.date) {
      newErrors.date = 'Date is required';
    }

    if (!formData.startTime) {
      newErrors.startTime = 'Start time is required';
    }

    if (!formData.endTime) {
      newErrors.endTime = 'End time is required';
    }

    if (formData.startTime && formData.endTime) {
      const startDateTime = new Date(`${formData.date}T${formData.startTime}`);
      const endDateTime = new Date(`${formData.date}T${formData.endTime}`);
      
      // Handle overnight check
      if (endDateTime <= startDateTime && formData.endTime <= formData.startTime) {
        // This is likely an error, not an overnight shift
        if (formData.endTime <= formData.startTime && 
            parseInt(formData.endTime.split(':')[0]) > parseInt(formData.startTime.split(':')[0]) - 12) {
          newErrors.endTime = 'End time must be after start time';
        }
      }
    }

    if (formData.breakMinutes < 0) {
      newErrors.breakMinutes = 'Break time cannot be negative';
    }

    if (formData.breakMinutes > 8 * 60) {
      newErrors.breakMinutes = 'Break time seems too long';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleClose = () => {
    setErrors({});
    setPreview(null);
    onHide();
  };

  // Initialize preview on first render
  useState(() => {
    setPreview(calculateShiftPreview(formData));
  });

  return (
    <Modal show={show} onHide={handleClose} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center">
          <Calendar size={20} className="me-2 text-primary" />
          {isEdit ? 'Edit Shift' : 'Add New Shift'}
        </Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {/* Date and Time Section */}
          <div className="row mb-3">
            <div className="col-md-4">
              <Form.Group>
                <Form.Label>Date</Form.Label>
                <Form.Control
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  isInvalid={!!errors.date}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.date}
                </Form.Control.Feedback>
              </Form.Group>
            </div>

            <div className="col-md-4">
              <Form.Group>
                <Form.Label>Start Time</Form.Label>
                <InputGroup>
                  <InputGroup.Text><Clock size={16} /></InputGroup.Text>
                  <Form.Control
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => handleInputChange('startTime', e.target.value)}
                    isInvalid={!!errors.startTime}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.startTime}
                  </Form.Control.Feedback>
                </InputGroup>
              </Form.Group>
            </div>

            <div className="col-md-4">
              <Form.Group>
                <Form.Label>End Time</Form.Label>
                <InputGroup>
                  <InputGroup.Text><Clock size={16} /></InputGroup.Text>
                  <Form.Control
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => handleInputChange('endTime', e.target.value)}
                    isInvalid={!!errors.endTime}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.endTime}
                  </Form.Control.Feedback>
                </InputGroup>
              </Form.Group>
            </div>
          </div>

          {/* Break and Shift Type */}
          <div className="row mb-3">
            <div className="col-md-6">
              <Form.Group>
                <Form.Label>Break Time (minutes)</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  max="480"
                  step="15"
                  value={formData.breakMinutes}
                  onChange={(e) => handleInputChange('breakMinutes', parseInt(e.target.value) || 0)}
                  isInvalid={!!errors.breakMinutes}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.breakMinutes}
                </Form.Control.Feedback>
              </Form.Group>
            </div>

            <div className="col-md-6">
              <Form.Group>
                <Form.Label>Shift Type</Form.Label>
                <Form.Select
                  value={formData.shiftType}
                  onChange={(e) => handleInputChange('shiftType', e.target.value as ShiftFormData['shiftType'])}
                >
                  <option value="REGULAR">Regular</option>
                  <option value="OVERTIME">Overtime</option>
                  <option value="WEEKEND">Weekend</option>
                  <option value="PUBLIC_HOLIDAY">Public Holiday</option>
                </Form.Select>
              </Form.Group>
            </div>
          </div>


          {/* Location */}
          <Form.Group className="mb-4">
            <Form.Label>Location (Optional)</Form.Label>
            <Form.Control
              type="text"
              placeholder="e.g., Main Store, North Branch, Office..."
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
            />
          </Form.Group>

          {/* Notes */}
          <Form.Group className="mb-4">
            <Form.Label>Notes (Optional)</Form.Label>
            <InputGroup>
              <InputGroup.Text><FileText size={16} /></InputGroup.Text>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="Any additional notes about this shift..."
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
              />
            </InputGroup>
          </Form.Group>

          {/* Shift Preview */}
          {preview && (
            <div className="p-3 bg-light rounded mb-3">
              <h6 className="mb-2 d-flex align-items-center">
                <DollarSign size={16} className="me-1 text-success" />
                Shift Preview
              </h6>
              
              <div className="row">
                <div className="col-6">
                  <small className="text-muted">Duration</small>
                  <div className="fw-bold">{preview.duration}h</div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Estimated Pay</small>
                  <div className="fw-bold text-success">
                    ${preview.estimatedPay.toFixed(2)}
                  </div>
                </div>
              </div>

              {preview.hasWarnings && (
                <Alert variant="warning" className="mt-2 mb-0 py-2">
                  <div className="d-flex align-items-start">
                    <AlertCircle size={16} className="me-2 mt-1 flex-shrink-0" />
                    <div>
                      {preview.warnings.map((warning, index) => (
                        <div key={index} className="small">{warning}</div>
                      ))}
                    </div>
                  </div>
                </Alert>
              )}
            </div>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="outline-secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            type="submit" 
            disabled={loading}
          >
            {loading && (
              <span className="spinner-border spinner-border-sm me-2" role="status" />
            )}
            {isEdit ? 'Update Shift' : 'Add Shift'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}