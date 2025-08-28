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
  interface PayGuideData {
    baseHourlyRate: string;
    casualLoading: string;
    dailyOvertimeHours: string;
    weeklyOvertimeHours: string;
    eveningPenalty: string;
    nightPenalty: string;
    saturdayPenalty: string;
    sundayPenalty: string;
    publicHolidayPenalty: string;
  }

  const [payGuideData, setPayGuideData] = useState<PayGuideData | null>(null);
  const [showPenaltyOverrides, setShowPenaltyOverrides] = useState(false);

  // Fetch pay guide data when selection changes
  useEffect(() => {
    if (formData.payGuideId) {
      fetchPayGuideData(formData.payGuideId);
    }
  }, [formData.payGuideId]);

  // Calculate shift preview with enhanced calculator

  useEffect(() => {
    if (formData.payGuideId && payGuideData) {
      const newPreview = calculateShiftPreview(formData);
      setPreview(newPreview);
    }
  }, [formData, payGuideData]);

  const fetchPayGuideData = async (payGuideId: string) => {
    try {
      const response = await fetch(`/api/pay-rates/${payGuideId}`);
      if (response.ok) {
        const data = await response.json();
        setPayGuideData(data);
      }
    } catch (error) {
      console.error('Error fetching pay guide data:', error);
    }
  };

  // Calculate shift preview with enhanced calculator
  const calculateShiftPreview = (data: ShiftFormData): ShiftPreview => {
    if (!payGuideData) {
      return {
        duration: 0,
        estimatedPay: 0,
        hasWarnings: false,
        warnings: [],
        appliedPenalties: []
      };
    }

    const startDateTime = new Date(`${data.date}T${data.startTime}`);
    const endDateTime = new Date(`${data.date}T${data.endTime}`);
    
    // Handle overnight shifts
    if (endDateTime <= startDateTime) {
      endDateTime.setDate(endDateTime.getDate() + 1);
    }

    const totalMinutes = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60);
    const workingMinutes = Math.max(0, totalMinutes - data.breakMinutes);
    const duration = workingMinutes / 60;

    // Mock calculation for now (would use EnhancedPayCalculator in real implementation)
    const baseRate = parseFloat(payGuideData.baseHourlyRate);
    const casualLoading = parseFloat(payGuideData.casualLoading);
    
    let regularPay = duration * baseRate;
    let overtimePay = 0;
    let penaltyPay = 0;

    // Calculate overtime
    if (duration > parseFloat(payGuideData.dailyOvertimeHours)) {
      const overtimeHours = duration - parseFloat(payGuideData.dailyOvertimeHours);
      overtimePay = overtimeHours * baseRate * 0.5; // 1.5x rate
      regularPay = parseFloat(payGuideData.dailyOvertimeHours) * baseRate;
    }

    // Determine applied penalties
    const appliedPenalties: string[] = [];
    const dayOfWeek = startDateTime.getDay();
    const hour = startDateTime.getHours();

    // Auto-detect penalties (can be overridden)
    const autoPenalties: PenaltyOverride = {};
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      autoPenalties.weekend = true;
      appliedPenalties.push(dayOfWeek === 0 ? 'Sunday' : 'Saturday');
    }
    
    if (hour >= 18 && hour < 22) {
      autoPenalties.evening = true;
      appliedPenalties.push('Evening');
    }
    
    if (hour >= 22 || hour < 6) {
      autoPenalties.night = true;
      appliedPenalties.push('Night');
    }

    // Apply overrides
    const finalPenalties = { ...autoPenalties, ...data.penaltyOverrides };
    
    // Calculate penalty pay
    if (finalPenalties.evening) {
      penaltyPay += duration * baseRate * (parseFloat(payGuideData.eveningPenalty) - 1);
    }
    if (finalPenalties.night) {
      penaltyPay += duration * baseRate * (parseFloat(payGuideData.nightPenalty) - 1);
    }
    if (finalPenalties.weekend) {
      const weekendMultiplier = dayOfWeek === 0 ? 
        parseFloat(payGuideData.sundayPenalty) : 
        parseFloat(payGuideData.saturdayPenalty);
      penaltyPay += duration * baseRate * (weekendMultiplier - 1);
    }

    // Apply casual loading
    const totalBeforeLoading = regularPay + overtimePay + penaltyPay;
    const casualLoadingAmount = totalBeforeLoading * casualLoading;
    const estimatedPay = totalBeforeLoading + casualLoadingAmount;

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

    // Check for penalty overrides
    if (!data.autoCalculatePenalties || Object.keys(data.penaltyOverrides || {}).length > 0) {
      warnings.push('Manual penalty overrides are active');
    }

    return {
      duration: Math.round(duration * 100) / 100,
      estimatedPay: Math.round(estimatedPay * 100) / 100,
      hasWarnings: warnings.length > 0,
      warnings,
      appliedPenalties,
      breakdown: {
        regularPay: Math.round(regularPay * 100) / 100,
        overtimePay: Math.round(overtimePay * 100) / 100,
        penaltyPay: Math.round(penaltyPay * 100) / 100,
        casualLoading: Math.round(casualLoadingAmount * 100) / 100
      }
    };
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
              {preview && (
                <Card className="sticky-top">
                  <Card.Header>
                    <h6 className="mb-0 d-flex align-items-center">
                      <DollarSign size={16} className="me-1 text-success" />
                      Shift Preview
                    </h6>
                  </Card.Header>
                  <Card.Body>
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