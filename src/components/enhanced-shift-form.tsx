'use client';

import { useState, useEffect } from 'react';
import { Form, Button, Modal, Alert, InputGroup, Row, Col, Card, Badge } from 'react-bootstrap';
import { Calendar, Clock, FileText, AlertCircle, DollarSign, Settings, ToggleLeft, ToggleRight, Info } from 'lucide-react';
import PayRateSelector from './pay-rate-selector';

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

export default function EnhancedShiftForm({ 
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
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showPenaltyOverrides, setShowPenaltyOverrides] = useState(false);
  
  // Debounce timer for API calls
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // Calculate shift preview with server-side API
  useEffect(() => {
    if (formData.payGuideId && formData.startTime && formData.endTime && formData.date) {
      // Clear any existing timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      
      // Set a new debounced timer
      const timer = setTimeout(() => {
        calculateShiftPreview(formData);
      }, 500); // 500ms debounce
      
      setDebounceTimer(timer);
      
      return () => {
        if (timer) {
          clearTimeout(timer);
        }
      };
    } else {
      setPreview(null);
    }
  }, [formData]);

  // Calculate shift preview using server-side API
  const calculateShiftPreview = async (data: ShiftFormData) => {
    if (!data.payGuideId || !data.startTime || !data.endTime || !data.date) {
      return;
    }
    
    setPreviewLoading(true);
    setPreviewError(null);
    
    try {
      const startTimeISO = `${data.date}T${data.startTime}:00.000Z`;
      let endTimeISO = `${data.date}T${data.endTime}:00.000Z`;
      
      // Handle overnight shifts
      const startTime = new Date(startTimeISO);
      const endTime = new Date(endTimeISO);
      if (endTime <= startTime) {
        const nextDay = new Date(endTime);
        nextDay.setDate(nextDay.getDate() + 1);
        endTimeISO = nextDay.toISOString();
      }
      
      const response = await fetch('/api/shifts/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startTime: startTimeISO,
          endTime: endTimeISO,
          breakMinutes: data.breakMinutes,
          payGuideId: data.payGuideId,
          penaltyOverrides: data.penaltyOverrides,
          autoCalculatePenalties: data.autoCalculatePenalties
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to calculate preview');
      }
      
      const previewData = await response.json();
      setPreview(previewData);
    } catch (error) {
      console.error('Preview calculation error:', error);
      setPreviewError(error instanceof Error ? error.message : 'Failed to calculate preview');
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };


  const handleInputChange = (field: keyof ShiftFormData, value: string | number | boolean | PenaltyOverride) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    
    // Clear related errors
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const handlePenaltyOverrideChange = (penaltyType: keyof PenaltyOverride, value: boolean | null) => {
    const newOverrides = { 
      ...formData.penaltyOverrides, 
      [penaltyType]: value 
    };
    handleInputChange('penaltyOverrides', newOverrides);
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

    if (!formData.payGuideId) {
      newErrors.payGuideId = 'Pay guide is required';
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

  const getPenaltyToggleIcon = (value: boolean | null | undefined) => {
    if (value === true) return <ToggleRight className="text-success" size={20} />;
    if (value === false) return <ToggleLeft className="text-danger" size={20} />;
    return <Settings className="text-muted" size={16} />; // Auto
  };

  return (
    <Modal show={show} onHide={handleClose} size="xl" centered>
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center">
          <Calendar size={20} className="me-2 text-primary" />
          {isEdit ? 'Edit Shift' : 'Add New Shift'}
        </Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <Row>
            <Col lg={8}>
              {/* Basic Shift Information */}
              <Card className="mb-4">
                <Card.Header>
                  <h6 className="mb-0">Shift Details</h6>
                </Card.Header>
                <Card.Body>
                  {/* Date and Time Section */}
                  <Row className="mb-3">
                    <Col md={4}>
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
                    </Col>

                    <Col md={4}>
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
                    </Col>

                    <Col md={4}>
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
                    </Col>
                  </Row>

                  {/* Break and Location */}
                  <Row className="mb-3">
                    <Col md={6}>
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
                    </Col>

                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Location (Optional)</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="e.g., Main Store, North Branch..."
                          value={formData.location}
                          onChange={(e) => handleInputChange('location', e.target.value)}
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* Pay Rate Selection */}
                  <PayRateSelector
                    selectedPayGuideId={formData.payGuideId}
                    onPayGuideChange={(payGuideId) => handleInputChange('payGuideId', payGuideId || '')}
                    className="mb-3"
                    showDetails={true}
                  />

                  {/* Notes */}
                  <Form.Group className="mb-3">
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
                </Card.Body>
              </Card>

              {/* Penalty Override Section */}
              <Card className="mb-4">
                <Card.Header className="d-flex align-items-center justify-content-between">
                  <h6 className="mb-0">Penalty Calculation</h6>
                  <Form.Check
                    type="switch"
                    id="autoCalculatePenalties"
                    label="Auto-calculate penalties"
                    checked={formData.autoCalculatePenalties}
                    onChange={(e) => {
                      handleInputChange('autoCalculatePenalties', e.target.checked);
                      setShowPenaltyOverrides(!e.target.checked);
                    }}
                  />
                </Card.Header>
                <Card.Body>
                  {!formData.autoCalculatePenalties && (
                    <Row>
                      <Col md={3}>
                        <Form.Group>
                          <Form.Label className="small">Evening Penalty</Form.Label>
                          <div className="d-flex align-items-center">
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => handlePenaltyOverrideChange('evening', 
                                formData.penaltyOverrides?.evening === true ? null : 
                                formData.penaltyOverrides?.evening === false ? true : false
                              )}
                              className="p-0 me-2"
                            >
                              {getPenaltyToggleIcon(formData.penaltyOverrides?.evening)}
                            </Button>
                            <small className="text-muted">
                              {formData.penaltyOverrides?.evening === true ? 'Forced ON' :
                               formData.penaltyOverrides?.evening === false ? 'Forced OFF' : 'Auto'}
                            </small>
                          </div>
                        </Form.Group>
                      </Col>

                      <Col md={3}>
                        <Form.Group>
                          <Form.Label className="small">Night Penalty</Form.Label>
                          <div className="d-flex align-items-center">
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => handlePenaltyOverrideChange('night', 
                                formData.penaltyOverrides?.night === true ? null : 
                                formData.penaltyOverrides?.night === false ? true : false
                              )}
                              className="p-0 me-2"
                            >
                              {getPenaltyToggleIcon(formData.penaltyOverrides?.night)}
                            </Button>
                            <small className="text-muted">
                              {formData.penaltyOverrides?.night === true ? 'Forced ON' :
                               formData.penaltyOverrides?.night === false ? 'Forced OFF' : 'Auto'}
                            </small>
                          </div>
                        </Form.Group>
                      </Col>

                      <Col md={3}>
                        <Form.Group>
                          <Form.Label className="small">Weekend Penalty</Form.Label>
                          <div className="d-flex align-items-center">
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => handlePenaltyOverrideChange('weekend', 
                                formData.penaltyOverrides?.weekend === true ? null : 
                                formData.penaltyOverrides?.weekend === false ? true : false
                              )}
                              className="p-0 me-2"
                            >
                              {getPenaltyToggleIcon(formData.penaltyOverrides?.weekend)}
                            </Button>
                            <small className="text-muted">
                              {formData.penaltyOverrides?.weekend === true ? 'Forced ON' :
                               formData.penaltyOverrides?.weekend === false ? 'Forced OFF' : 'Auto'}
                            </small>
                          </div>
                        </Form.Group>
                      </Col>

                      <Col md={3}>
                        <Form.Group>
                          <Form.Label className="small">Public Holiday</Form.Label>
                          <div className="d-flex align-items-center">
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => handlePenaltyOverrideChange('publicHoliday', 
                                formData.penaltyOverrides?.publicHoliday === true ? null : 
                                formData.penaltyOverrides?.publicHoliday === false ? true : false
                              )}
                              className="p-0 me-2"
                            >
                              {getPenaltyToggleIcon(formData.penaltyOverrides?.publicHoliday)}
                            </Button>
                            <small className="text-muted">
                              {formData.penaltyOverrides?.publicHoliday === true ? 'Forced ON' :
                               formData.penaltyOverrides?.publicHoliday === false ? 'Forced OFF' : 'Auto'}
                            </small>
                          </div>
                        </Form.Group>
                      </Col>
                    </Row>
                  )}
                  
                  <Form.Text className="text-muted">
                    <Info size={12} className="me-1" />
                    {formData.autoCalculatePenalties ? 
                      'Penalties are automatically calculated based on shift date and time.' :
                      'Click penalty toggles to override automatic calculation. Useful for breaks, special circumstances, etc.'
                    }
                  </Form.Text>
                </Card.Body>
              </Card>
            </Col>

            {/* Shift Preview */}
            <Col lg={4}>
              {(preview || previewLoading || previewError) && (
                <Card className="sticky-top">
                  <Card.Header>
                    <h6 className="mb-0 d-flex align-items-center">
                      <DollarSign size={16} className="me-1 text-success" />
                      Shift Preview
                    </h6>
                  </Card.Header>
                  <Card.Body>
                    {previewLoading && (
                      <div className="d-flex justify-content-center align-items-center py-4">
                        <div className="spinner-border spinner-border-sm me-2" role="status" />
                        <span className="text-muted">Calculating...</span>
                      </div>
                    )}
                    
                    {previewError && (
                      <Alert variant="warning" className="py-2 mb-0">
                        <div className="d-flex align-items-start">
                          <AlertCircle size={16} className="me-2 mt-1 flex-shrink-0" />
                          <div className="small">
                            Error calculating preview: {previewError}
                          </div>
                        </div>
                      </Alert>
                    )}
                    
                    {preview && !previewLoading && (
                      <>
                        <div className="mb-3">
                          <div className="d-flex justify-content-between mb-2">
                            <span className="text-muted">Duration</span>
                            <strong>{preview.duration}h</strong>
                          </div>
                          <div className="d-flex justify-content-between mb-3">
                            <span className="text-muted">Estimated Pay</span>
                            <strong className="text-success h5 mb-0">
                              ${preview.estimatedPay.toFixed(2)}
                            </strong>
                          </div>
                        </div>

                    {preview.breakdown && (
                      <div className="mb-3">
                        <small className="text-muted fw-bold">Breakdown:</small>
                        <div className="small mt-1">
                          <div className="d-flex justify-content-between">
                            <span>Regular</span>
                            <span>${preview.breakdown.regularPay.toFixed(2)}</span>
                          </div>
                          {preview.breakdown.overtimePay > 0 && (
                            <div className="d-flex justify-content-between">
                              <span>Overtime</span>
                              <span>${preview.breakdown.overtimePay.toFixed(2)}</span>
                            </div>
                          )}
                          {preview.breakdown.penaltyPay > 0 && (
                            <div className="d-flex justify-content-between">
                              <span>Penalties</span>
                              <span>${preview.breakdown.penaltyPay.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="d-flex justify-content-between">
                            <span>Casual Loading</span>
                            <span>${preview.breakdown.casualLoading.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {preview.appliedPenalties.length > 0 && (
                      <div className="mb-3">
                        <small className="text-muted fw-bold">Applied Penalties:</small>
                        <div className="mt-1">
                          {preview.appliedPenalties.map((penalty, index) => (
                            <Badge key={index} bg="info" className="me-1 small">
                              {penalty}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                        {preview.hasWarnings && (
                          <Alert variant="warning" className="py-2 mb-0">
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
                      </>
                    )}
                  </Card.Body>
                </Card>
              )}
            </Col>
          </Row>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="outline-secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            type="submit" 
            disabled={loading || !formData.payGuideId}
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