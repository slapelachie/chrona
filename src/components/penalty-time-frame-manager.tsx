'use client';

import { useState, useEffect } from 'react';
import { Button, Table, Badge, Modal, Form, Alert, InputGroup, Tooltip, OverlayTrigger, ButtonGroup } from 'react-bootstrap';
import { Plus, Edit2, Trash2, Clock, Calendar } from 'lucide-react';
import { PenaltyTimeFrame, PenaltyTimeFrameFormData } from '@/types';
import Decimal from 'decimal.js';

interface PenaltyTimeFrameManagerProps {
  payGuideId: string;
  onUpdate?: () => void;
}

const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

export default function PenaltyTimeFrameManager({ payGuideId, onUpdate }: PenaltyTimeFrameManagerProps) {
  const [penalties, setPenalties] = useState<PenaltyTimeFrame[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedPenalty, setSelectedPenalty] = useState<PenaltyTimeFrame | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState<PenaltyTimeFrameFormData>({
    name: '',
    description: '',
    startTime: '18:00',
    endTime: '22:00',
    penaltyRate: '1.5',
    dayOfWeek: undefined,
    priority: 0,
    isActive: true
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    fetchPenalties();
  }, [payGuideId]);

  const fetchPenalties = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/pay-guides/${payGuideId}/penalties`);
      if (response.ok) {
        const data = await response.json();
        setPenalties(data);
      } else {
        throw new Error('Failed to fetch penalty time frames');
      }
    } catch (error) {
      console.error('Error fetching penalty time frames:', error);
      setAlertMessage({ type: 'error', message: 'Failed to load penalty time frames' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setModalMode('create');
    setSelectedPenalty(null);
    setFormData({
      name: '',
      description: '',
      startTime: '18:00',
      endTime: '22:00',
      penaltyRate: '1.5',
      dayOfWeek: undefined,
      priority: 0,
      isActive: true
    });
    setErrors({});
    setShowModal(true);
  };

  const handleEdit = (penalty: PenaltyTimeFrame) => {
    setModalMode('edit');
    setSelectedPenalty(penalty);
    setFormData({
      name: penalty.name,
      description: penalty.description || '',
      startTime: penalty.startTime,
      endTime: penalty.endTime,
      penaltyRate: penalty.penaltyRate.toString(),
      dayOfWeek: penalty.dayOfWeek ?? undefined,
      priority: penalty.priority,
      isActive: penalty.isActive
    });
    setErrors({});
    setShowModal(true);
  };

  const handleDelete = async (penalty: PenaltyTimeFrame) => {
    if (!confirm(`Are you sure you want to delete "${penalty.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/penalties/${penalty.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setAlertMessage({ type: 'success', message: 'Penalty time frame deleted successfully' });
        fetchPenalties();
        onUpdate?.();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete penalty time frame');
      }
    } catch (error: unknown) {
      console.error('Error deleting penalty time frame:', error);
      setAlertMessage({ type: 'error', message: error instanceof Error ? error.message : 'An unknown error occurred' });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.startTime) {
      newErrors.startTime = 'Start time is required';
    }

    if (!formData.endTime) {
      newErrors.endTime = 'End time is required';
    }

    const penaltyRate = new Decimal(formData.penaltyRate || '1.0');
    if (penaltyRate.lt(1)) {
      newErrors.penaltyRate = 'Penalty rate must be 1.0 or greater';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      setSaving(true);
      
      const url = modalMode === 'edit' && selectedPenalty 
        ? `/api/penalties/${selectedPenalty.id}`
        : `/api/pay-guides/${payGuideId}/penalties`;
      
      const method = modalMode === 'edit' ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          dayOfWeek: formData.dayOfWeek ?? null
        })
      });

      if (response.ok) {
        setShowModal(false);
        setAlertMessage({ 
          type: 'success', 
          message: modalMode === 'edit' ? 'Penalty updated successfully' : 'Penalty created successfully'
        });
        fetchPenalties();
        onUpdate?.();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save penalty');
      }
    } catch (error: unknown) {
      console.error('Error saving penalty:', error);
      setAlertMessage({ type: 'error', message: error instanceof Error ? error.message : 'An unknown error occurred' });
    } finally {
      setSaving(false);
    }
  };

  const formatPercentage = (rate: string) => {
    const decimal = new Decimal(rate);
    const percentage = decimal.sub(1).mul(100);
    return `+${percentage.toFixed(0)}%`;
  };

  const formatTimeRange = (startTime: string, endTime: string) => {
    return `${startTime} - ${endTime}`;
  };

  return (
    <div>
      {/* Alert Messages */}
      {alertMessage && (
        <Alert 
          variant={alertMessage.type === 'success' ? 'success' : 'danger'}
          onClose={() => setAlertMessage(null)}
          dismissible
          className="mb-3"
        >
          {alertMessage.message}
        </Alert>
      )}

      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="d-flex align-items-center">
          <Clock size={20} className="text-primary me-2" />
          <h6 className="mb-0">Custom Penalty Time Frames</h6>
        </div>
        <Button variant="outline-primary" size="sm" onClick={handleCreateNew}>
          <Plus size={16} className="me-1" />
          Add Penalty
        </Button>
      </div>

      {/* Penalty Table */}
      {loading ? (
        <div className="d-flex justify-content-center p-4">
          <div className="spinner-border spinner-border-sm text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <Table responsive hover size="sm">
          <thead>
            <tr>
              <th>Name</th>
              <th>Time Range</th>
              <th>Rate</th>
              <th>Days</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {penalties.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-3 text-muted">
                  No custom penalties defined. Click "Add Penalty" to create your first one.
                </td>
              </tr>
            ) : (
              penalties.map((penalty) => (
                <tr key={penalty.id}>
                  <td>
                    <div>
                      <div className="fw-bold">{penalty.name}</div>
                      {penalty.description && (
                        <small className="text-muted">{penalty.description}</small>
                      )}
                    </div>
                  </td>
                  <td>
                    <code className="text-primary">
                      {formatTimeRange(penalty.startTime, penalty.endTime)}
                    </code>
                  </td>
                  <td>
                    <span className="fw-bold text-success">
                      {formatPercentage(penalty.penaltyRate.toString())}
                    </span>
                  </td>
                  <td>
                    <Badge bg="light" text="dark">
                      {penalty.dayOfWeek !== null ? DAYS_OF_WEEK[penalty.dayOfWeek] : 'All days'}
                    </Badge>
                  </td>
                  <td>
                    <Badge bg="secondary">
                      {penalty.priority}
                    </Badge>
                  </td>
                  <td>
                    <Badge bg={penalty.isActive ? 'success' : 'secondary'}>
                      {penalty.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td>
                    <ButtonGroup size="sm">
                      <OverlayTrigger overlay={<Tooltip>Edit</Tooltip>}>
                        <Button 
                          variant="outline-primary" 
                          size="sm"
                          onClick={() => handleEdit(penalty)}
                        >
                          <Edit2 size={14} />
                        </Button>
                      </OverlayTrigger>
                      
                      <OverlayTrigger overlay={<Tooltip>Delete</Tooltip>}>
                        <Button 
                          variant="outline-danger" 
                          size="sm"
                          onClick={() => handleDelete(penalty)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </OverlayTrigger>
                    </ButtonGroup>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      )}

      {/* Create/Edit Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {modalMode === 'create' ? 'Add Custom Penalty' : 'Edit Custom Penalty'}
          </Modal.Title>
        </Modal.Header>
        
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            {/* Basic Information */}
            <div className="mb-4">
              <h6 className="text-primary mb-3">Basic Information</h6>
              
              <Form.Group className="mb-3">
                <Form.Label>Name *</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  isInvalid={!!errors.name}
                  placeholder="e.g., Late Night Premium, Early Morning Bonus"
                />
                <Form.Control.Feedback type="invalid">
                  {errors.name}
                </Form.Control.Feedback>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Description (Optional)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description for this penalty rule"
                />
              </Form.Group>
            </div>

            {/* Time Configuration */}
            <div className="mb-4">
              <h6 className="text-primary mb-3">Time Configuration</h6>
              <div className="row">
                <div className="col-md-6">
                  <Form.Group className="mb-3">
                    <Form.Label>Start Time *</Form.Label>
                    <Form.Control
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      isInvalid={!!errors.startTime}
                    />
                    <Form.Control.Feedback type="invalid">
                      {errors.startTime}
                    </Form.Control.Feedback>
                  </Form.Group>
                </div>
                <div className="col-md-6">
                  <Form.Group className="mb-3">
                    <Form.Label>End Time *</Form.Label>
                    <Form.Control
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      isInvalid={!!errors.endTime}
                    />
                    <Form.Control.Feedback type="invalid">
                      {errors.endTime}
                    </Form.Control.Feedback>
                  </Form.Group>
                </div>
              </div>

              <Form.Group className="mb-3">
                <Form.Label>Day of Week</Form.Label>
                <Form.Select
                  value={formData.dayOfWeek ?? ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    dayOfWeek: e.target.value === '' ? undefined : parseInt(e.target.value)
                  })}
                >
                  <option value="">All days</option>
                  {DAYS_OF_WEEK.map((day, index) => (
                    <option key={index} value={index}>{day}</option>
                  ))}
                </Form.Select>
                <Form.Text className="text-muted">
                  Leave as "All days" to apply to every day, or select a specific day
                </Form.Text>
              </Form.Group>
            </div>

            {/* Rate & Priority */}
            <div className="mb-4">
              <h6 className="text-primary mb-3">Rate & Priority</h6>
              <div className="row">
                <div className="col-md-6">
                  <Form.Group className="mb-3">
                    <Form.Label>Penalty Rate *</Form.Label>
                    <InputGroup>
                      <Form.Control
                        type="number"
                        step="0.01"
                        min="1.00"
                        value={formData.penaltyRate}
                        onChange={(e) => setFormData({ ...formData, penaltyRate: e.target.value })}
                        isInvalid={!!errors.penaltyRate}
                      />
                      <InputGroup.Text>x ({formatPercentage(formData.penaltyRate || '1')})</InputGroup.Text>
                      <Form.Control.Feedback type="invalid">
                        {errors.penaltyRate}
                      </Form.Control.Feedback>
                    </InputGroup>
                    <Form.Text className="text-muted">
                      Base rate multiplier (1.5 = 50% penalty)
                    </Form.Text>
                  </Form.Group>
                </div>
                <div className="col-md-6">
                  <Form.Group className="mb-3">
                    <Form.Label>Priority</Form.Label>
                    <Form.Control
                      type="number"
                      min="0"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                    />
                    <Form.Text className="text-muted">
                      Higher numbers take precedence when penalties overlap
                    </Form.Text>
                  </Form.Group>
                </div>
              </div>

              <Form.Group className="mb-3">
                <Form.Check
                  type="switch"
                  id="penalty-active"
                  label={formData.isActive ? 'Active' : 'Inactive'}
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
              </Form.Group>
            </div>
          </Modal.Body>
          
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving && <span className="spinner-border spinner-border-sm me-2" />}
              {modalMode === 'create' ? 'Create Penalty' : 'Update Penalty'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}