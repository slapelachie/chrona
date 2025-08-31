'use client';

import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Badge, Modal, Form, Alert, InputGroup, Tooltip, OverlayTrigger } from 'react-bootstrap';
import { DollarSign, Plus, Edit2, Copy, Trash2, Search, CheckCircle, XCircle, Clock } from 'lucide-react';
import Decimal from 'decimal.js';
import PenaltyTimeFrameManager from '@/components/penalty-time-frame-manager';

interface PayGuide {
  id: string;
  name: string;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive: boolean;
  baseHourlyRate: string;
  casualLoading: string;
  overtimeRate1_5x: string;
  overtimeRate2x: string;
  dailyOvertimeHours: string;
  weeklyOvertimeHours: string;
  createdAt: string;
  updatedAt: string;
}

interface PayGuideFormData {
  name: string;
  effectiveFrom: string;
  effectiveTo: string;
  isActive: boolean;
  baseHourlyRate: string;
  casualLoading: string;
  overtimeRate1_5x: string;
  overtimeRate2x: string;
  dailyOvertimeHours: string;
  weeklyOvertimeHours: string;
}

export default function PayRatesPage() {
  const [payGuides, setPayGuides] = useState<PayGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedPayGuide, setSelectedPayGuide] = useState<PayGuide | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Penalty management modal states
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [penaltyPayGuideId, setPenaltyPayGuideId] = useState<string | null>(null);
  const [penaltyPayGuideName, setPenaltyPayGuideName] = useState<string>('');
  
  // Form state
  const [formData, setFormData] = useState<PayGuideFormData>({
    name: '',
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: '',
    isActive: true,
    baseHourlyRate: '25.00',
    casualLoading: '0.25',
    overtimeRate1_5x: '1.5',
    overtimeRate2x: '2.0',
    dailyOvertimeHours: '8.0',
    weeklyOvertimeHours: '38.0'
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    fetchPayGuides();
  }, []);

  const fetchPayGuides = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      if (showActiveOnly) params.set('active', 'true');
      
      const response = await fetch(`/api/pay-rates?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setPayGuides(data);
      } else {
        throw new Error('Failed to fetch pay guides');
      }
    } catch (error) {
      console.error('Error fetching pay guides:', error);
      setAlertMessage({ type: 'error', message: 'Failed to load pay guides' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchPayGuides();
    }, 500);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, showActiveOnly]);

  const handleCreateNew = () => {
    setModalMode('create');
    setSelectedPayGuide(null);
    setFormData({
      name: '',
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: '',
      isActive: true,
      baseHourlyRate: '25.00',
      casualLoading: '0.25',
      overtimeRate1_5x: '1.5',
      overtimeRate2x: '2.0',
      dailyOvertimeHours: '8.0',
      weeklyOvertimeHours: '38.0'
    });
    setErrors({});
    setShowModal(true);
  };

  const handleEdit = (payGuide: PayGuide) => {
    setModalMode('edit');
    setSelectedPayGuide(payGuide);
    setFormData({
      name: payGuide.name,
      effectiveFrom: payGuide.effectiveFrom.split('T')[0],
      effectiveTo: payGuide.effectiveTo ? payGuide.effectiveTo.split('T')[0] : '',
      isActive: payGuide.isActive,
      baseHourlyRate: payGuide.baseHourlyRate,
      casualLoading: payGuide.casualLoading,
      overtimeRate1_5x: payGuide.overtimeRate1_5x,
      overtimeRate2x: payGuide.overtimeRate2x,
      dailyOvertimeHours: payGuide.dailyOvertimeHours,
      weeklyOvertimeHours: payGuide.weeklyOvertimeHours
    });
    setErrors({});
    setShowModal(true);
  };

  const handleDuplicate = async (payGuide: PayGuide) => {
    try {
      const response = await fetch(`/api/pay-rates/${payGuide.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${payGuide.name} (Copy)` })
      });

      if (response.ok) {
        setAlertMessage({ type: 'success', message: 'Pay guide duplicated successfully' });
        fetchPayGuides();
      } else {
        throw new Error('Failed to duplicate pay guide');
      }
    } catch (error) {
      console.error('Error duplicating pay guide:', error);
      setAlertMessage({ type: 'error', message: 'Failed to duplicate pay guide' });
    }
  };

  const handleManagePenalties = (payGuide: PayGuide) => {
    setPenaltyPayGuideId(payGuide.id);
    setPenaltyPayGuideName(payGuide.name);
    setShowPenaltyModal(true);
  };

  const handleDelete = async (payGuide: PayGuide) => {
    if (!confirm(`Are you sure you want to delete "${payGuide.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/pay-rates/${payGuide.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setAlertMessage({ type: 'success', message: 'Pay guide deleted successfully' });
        fetchPayGuides();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete pay guide');
      }
    } catch (error: unknown) {
      console.error('Error deleting pay guide:', error);
      setAlertMessage({ type: 'error', message: error instanceof Error ? error.message : 'An unknown error occurred' });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.effectiveFrom) {
      newErrors.effectiveFrom = 'Effective from date is required';
    }

    if (!formData.baseHourlyRate || parseFloat(formData.baseHourlyRate) <= 0) {
      newErrors.baseHourlyRate = 'Base hourly rate must be greater than 0';
    }

    if (parseFloat(formData.casualLoading) < 0) {
      newErrors.casualLoading = 'Casual loading cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      setSaving(true);
      
      const url = modalMode === 'edit' && selectedPayGuide 
        ? `/api/pay-rates/${selectedPayGuide.id}`
        : '/api/pay-rates';
      
      const method = modalMode === 'edit' ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setShowModal(false);
        setAlertMessage({ 
          type: 'success', 
          message: modalMode === 'edit' ? 'Pay guide updated successfully' : 'Pay guide created successfully'
        });
        fetchPayGuides();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save pay guide');
      }
    } catch (error: unknown) {
      console.error('Error saving pay guide:', error);
      setAlertMessage({ type: 'error', message: error instanceof Error ? error.message : 'An unknown error occurred' });
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: string) => {
    return new Decimal(amount).toFixed(2);
  };

  const formatPercentage = (rate: string) => {
    const decimal = new Decimal(rate);
    const percentage = decimal.sub(1).mul(100);
    return `${percentage.toFixed(0)}%`;
  };

  const filteredPayGuides = payGuides.filter(guide => {
    const matchesSearch = guide.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesActive = !showActiveOnly || guide.isActive;
    return matchesSearch && matchesActive;
  });

  return (
    <Container fluid className="py-4">
      {/* Page Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center">
              <DollarSign size={32} className="text-primary me-3" />
              <div>
                <h1 className="h3 mb-0">Pay Rate Management</h1>
                <p className="text-muted mb-0">Manage your award rates and penalty settings</p>
              </div>
            </div>
            <Button variant="primary" onClick={handleCreateNew}>
              <Plus size={16} className="me-2" />
              New Pay Guide
            </Button>
          </div>
        </Col>
      </Row>

      {/* Alert Messages */}
      {alertMessage && (
        <Row className="mb-3">
          <Col>
            <Alert 
              variant={alertMessage.type === 'success' ? 'success' : 'danger'}
              onClose={() => setAlertMessage(null)}
              dismissible
            >
              {alertMessage.message}
            </Alert>
          </Col>
        </Row>
      )}

      {/* Search and Filters */}
      <Row className="mb-4">
        <Col md={8}>
          <InputGroup>
            <InputGroup.Text><Search size={16} /></InputGroup.Text>
            <Form.Control
              type="text"
              placeholder="Search pay guides..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
        </Col>
        <Col md={4}>
          <Form.Check
            type="switch"
            id="active-only"
            label="Show active only"
            checked={showActiveOnly}
            onChange={(e) => setShowActiveOnly(e.target.checked)}
          />
        </Col>
      </Row>

      {/* Pay Guides Table */}
      <Row>
        <Col>
          <Card>
            <Card.Body className="p-0">
              {loading ? (
                <div className="d-flex justify-content-center p-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : (
                <Table responsive hover className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Name</th>
                      <th>Base Rate</th>
                      <th>Overtime Rates</th>
                      <th>Effective Period</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayGuides.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-4 text-muted">
                          {payGuides.length === 0 ? 'No pay guides found' : 'No pay guides match your search'}
                        </td>
                      </tr>
                    ) : (
                      filteredPayGuides.map((guide) => (
                        <tr key={guide.id}>
                          <td>
                            <div>
                              <div className="fw-bold">{guide.name}</div>
                              <small className="text-muted">
                                Casual loading: {guide.casualLoading ? formatPercentage(guide.casualLoading) : '0%'}
                              </small>
                            </div>
                          </td>
                          <td>
                            <div className="fw-bold text-success">
                              ${formatCurrency(guide.baseHourlyRate)}
                            </div>
                            <small className="text-muted">per hour</small>
                          </td>
                          <td>
                            <div className="d-flex flex-wrap gap-1">
                              <Badge bg="secondary" className="small">
                                1.5x: {formatCurrency(new Decimal(guide.baseHourlyRate).mul(guide.overtimeRate1_5x).toString())}
                              </Badge>
                              <Badge bg="secondary" className="small">
                                2x: {formatCurrency(new Decimal(guide.baseHourlyRate).mul(guide.overtimeRate2x).toString())}
                              </Badge>
                            </div>
                            <small className="text-muted d-block">
                              Daily OT: {guide.dailyOvertimeHours}h • Weekly: {guide.weeklyOvertimeHours}h
                            </small>
                          </td>
                          <td>
                            <div>
                              <small className="text-muted">From:</small> {new Date(guide.effectiveFrom).toLocaleDateString()}
                              {guide.effectiveTo && (
                                <div>
                                  <small className="text-muted">To:</small> {new Date(guide.effectiveTo).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <Badge bg={guide.isActive ? 'success' : 'secondary'}>
                              {guide.isActive ? (
                                <><CheckCircle size={12} className="me-1" />Active</>
                              ) : (
                                <><XCircle size={12} className="me-1" />Inactive</>
                              )}
                            </Badge>
                          </td>
                          <td>
                            <div className="d-flex gap-1">
                              <OverlayTrigger overlay={<Tooltip>Edit</Tooltip>}>
                                <Button 
                                  variant="outline-primary" 
                                  size="sm"
                                  onClick={() => handleEdit(guide)}
                                >
                                  <Edit2 size={14} />
                                </Button>
                              </OverlayTrigger>
                              
                              <OverlayTrigger overlay={<Tooltip>Manage Penalties</Tooltip>}>
                                <Button 
                                  variant="outline-info" 
                                  size="sm"
                                  onClick={() => handleManagePenalties(guide)}
                                >
                                  <Clock size={14} />
                                </Button>
                              </OverlayTrigger>
                              
                              <OverlayTrigger overlay={<Tooltip>Duplicate</Tooltip>}>
                                <Button 
                                  variant="outline-secondary" 
                                  size="sm"
                                  onClick={() => handleDuplicate(guide)}
                                >
                                  <Copy size={14} />
                                </Button>
                              </OverlayTrigger>
                              
                              <OverlayTrigger overlay={<Tooltip>Delete</Tooltip>}>
                                <Button 
                                  variant="outline-danger" 
                                  size="sm"
                                  onClick={() => handleDelete(guide)}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </OverlayTrigger>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Create/Edit Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {modalMode === 'create' ? 'Create New Pay Guide' : 'Edit Pay Guide'}
          </Modal.Title>
        </Modal.Header>
        
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            {/* Basic Information */}
            <div className="mb-4">
              <h6 className="text-primary mb-3">Basic Information</h6>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Name *</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      isInvalid={!!errors.name}
                      placeholder="e.g., General Retail Award 2024"
                    />
                    <Form.Control.Feedback type="invalid">
                      {errors.name}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Status</Form.Label>
                    <Form.Check
                      type="switch"
                      id="isActive"
                      label={formData.isActive ? 'Active' : 'Inactive'}
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                  </Form.Group>
                </Col>
              </Row>
              
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Effective From *</Form.Label>
                    <Form.Control
                      type="date"
                      value={formData.effectiveFrom}
                      onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                      isInvalid={!!errors.effectiveFrom}
                    />
                    <Form.Control.Feedback type="invalid">
                      {errors.effectiveFrom}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Effective To (Optional)</Form.Label>
                    <Form.Control
                      type="date"
                      value={formData.effectiveTo}
                      onChange={(e) => setFormData({ ...formData, effectiveTo: e.target.value })}
                    />
                    <Form.Text className="text-muted">Leave blank if no end date</Form.Text>
                  </Form.Group>
                </Col>
              </Row>
            </div>

            {/* Pay Rates */}
            <div className="mb-4">
              <h6 className="text-primary mb-3">Pay Rates</h6>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Base Hourly Rate *</Form.Label>
                    <InputGroup>
                      <InputGroup.Text>$</InputGroup.Text>
                      <Form.Control
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.baseHourlyRate}
                        onChange={(e) => setFormData({ ...formData, baseHourlyRate: e.target.value })}
                        isInvalid={!!errors.baseHourlyRate}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.baseHourlyRate}
                      </Form.Control.Feedback>
                    </InputGroup>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Casual Loading</Form.Label>
                    <InputGroup>
                      <Form.Control
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.casualLoading}
                        onChange={(e) => setFormData({ ...formData, casualLoading: e.target.value })}
                      />
                      <InputGroup.Text>({formatPercentage(formData.casualLoading || '0')})</InputGroup.Text>
                    </InputGroup>
                  </Form.Group>
                </Col>
              </Row>
            </div>

            {/* Overtime Rates */}
            <div className="mb-4">
              <h6 className="text-primary mb-3">Overtime Rates</h6>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>First Overtime Rate (1.5x)</Form.Label>
                    <InputGroup>
                      <Form.Control
                        type="number"
                        step="0.01"
                        min="1"
                        value={formData.overtimeRate1_5x}
                        onChange={(e) => setFormData({ ...formData, overtimeRate1_5x: e.target.value })}
                      />
                      <InputGroup.Text>x base rate</InputGroup.Text>
                    </InputGroup>
                    <Form.Text className="text-muted">
                      Rate: ${formatCurrency(new Decimal(formData.baseHourlyRate || '0').mul(formData.overtimeRate1_5x || '1').toString())}
                    </Form.Text>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Second Overtime Rate (2x)</Form.Label>
                    <InputGroup>
                      <Form.Control
                        type="number"
                        step="0.01"
                        min="1"
                        value={formData.overtimeRate2x}
                        onChange={(e) => setFormData({ ...formData, overtimeRate2x: e.target.value })}
                      />
                      <InputGroup.Text>x base rate</InputGroup.Text>
                    </InputGroup>
                    <Form.Text className="text-muted">
                      Rate: ${formatCurrency(new Decimal(formData.baseHourlyRate || '0').mul(formData.overtimeRate2x || '1').toString())}
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>
            </div>

            {/* Overtime Thresholds */}
            <div className="mb-4">
              <h6 className="text-primary mb-3">Overtime Thresholds</h6>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Daily Overtime Hours</Form.Label>
                    <InputGroup>
                      <Form.Control
                        type="number"
                        step="0.25"
                        min="1"
                        value={formData.dailyOvertimeHours}
                        onChange={(e) => setFormData({ ...formData, dailyOvertimeHours: e.target.value })}
                      />
                      <InputGroup.Text>hours</InputGroup.Text>
                    </InputGroup>
                    <Form.Text className="text-muted">Overtime applies after this many hours per day</Form.Text>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Weekly Overtime Hours</Form.Label>
                    <InputGroup>
                      <Form.Control
                        type="number"
                        step="0.25"
                        min="1"
                        value={formData.weeklyOvertimeHours}
                        onChange={(e) => setFormData({ ...formData, weeklyOvertimeHours: e.target.value })}
                      />
                      <InputGroup.Text>hours</InputGroup.Text>
                    </InputGroup>
                    <Form.Text className="text-muted">Overtime applies after this many hours per week</Form.Text>
                  </Form.Group>
                </Col>
              </Row>
            </div>
          </Modal.Body>
          
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving && <span className="spinner-border spinner-border-sm me-2" />}
              {modalMode === 'create' ? 'Create Pay Guide' : 'Update Pay Guide'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Penalty Management Modal */}
      <Modal show={showPenaltyModal} onHide={() => setShowPenaltyModal(false)} size="xl" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <Clock size={24} className="text-primary me-2" />
            Manage Custom Penalties - {penaltyPayGuideName}
          </Modal.Title>
        </Modal.Header>
        
        <Modal.Body>
          {penaltyPayGuideId && (
            <PenaltyTimeFrameManager 
              payGuideId={penaltyPayGuideId}
              onUpdate={() => {
                // Optionally refresh pay guides list if needed
                // fetchPayGuides();
              }}
            />
          )}
        </Modal.Body>
        
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPenaltyModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}