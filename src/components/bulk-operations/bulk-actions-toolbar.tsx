'use client';

import { useState } from 'react';
import { Card, Button, Dropdown, Form, Modal, Alert, Spinner } from 'react-bootstrap';
import { 
  Trash2, 
  Edit, 
  Download, 
  CheckCircle, 
  XCircle, 
  Clock, 
  X, 
  MapPin,
  FileText
} from 'lucide-react';
import { useBulkSelection } from './bulk-selection-provider';

interface BulkActionsToolbarProps {
  onBulkDelete: (shiftIds: string[]) => Promise<void>;
  onBulkStatusUpdate: (shiftIds: string[], status: string) => Promise<void>;
  onBulkLocationUpdate: (shiftIds: string[], location: string) => Promise<void>;
  onBulkNotesUpdate: (shiftIds: string[], notes: string, mode: 'replace' | 'append' | 'prepend') => Promise<void>;
  onBulkExport: (shiftIds: string[], format: 'csv' | 'pdf') => Promise<void>;
  className?: string;
}

export default function BulkActionsToolbar({
  onBulkDelete,
  onBulkStatusUpdate,
  onBulkLocationUpdate,
  onBulkNotesUpdate,
  onBulkExport,
  className = ''
}: BulkActionsToolbarProps) {
  const { selectedShifts, selectedCount, deselectAll } = useBulkSelection();
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form states
  const [newLocation, setNewLocation] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [notesMode, setNotesMode] = useState<'replace' | 'append' | 'prepend'>('replace');

  const selectedShiftIds = Array.from(selectedShifts);

  const handleBulkAction = async (action: () => Promise<void>) => {
    try {
      setLoading(true);
      setError(null);
      await action();
      deselectAll();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    handleBulkAction(async () => {
      await onBulkDelete(selectedShiftIds);
      setShowDeleteConfirm(false);
    });
  };

  const handleStatusUpdate = (status: string) => {
    handleBulkAction(async () => {
      await onBulkStatusUpdate(selectedShiftIds, status);
    });
  };

  const handleLocationUpdate = () => {
    handleBulkAction(async () => {
      await onBulkLocationUpdate(selectedShiftIds, newLocation);
      setShowLocationModal(false);
      setNewLocation('');
    });
  };

  const handleNotesUpdate = () => {
    handleBulkAction(async () => {
      await onBulkNotesUpdate(selectedShiftIds, newNotes, notesMode);
      setShowNotesModal(false);
      setNewNotes('');
    });
  };

  const handleExport = (format: 'csv' | 'pdf') => {
    handleBulkAction(async () => {
      await onBulkExport(selectedShiftIds, format);
    });
  };

  if (selectedCount === 0) {
    return null;
  }

  return (
    <>
      <div className={`position-fixed bottom-0 start-50 translate-middle-x mb-3 ${className}`} 
           style={{ zIndex: 1040 }}>
        <Card className="border-0 shadow-lg">
          <Card.Body className="px-3 py-2">
            {error && (
              <Alert variant="danger" className="mb-2 py-1 small">
                {error}
              </Alert>
            )}
            
            <div className="d-flex align-items-center gap-2">
              <span className="small fw-semibold text-primary">
                {selectedCount} shift{selectedCount !== 1 ? 's' : ''} selected
              </span>

              {/* Status Update */}
              <Dropdown>
                <Dropdown.Toggle 
                  variant="outline-secondary" 
                  size="sm" 
                  disabled={loading}
                >
                  <CheckCircle size={14} className="me-1" />
                  Status
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item onClick={() => handleStatusUpdate('COMPLETED')}>
                    <CheckCircle size={12} className="me-2 text-success" />
                    Mark as Completed
                  </Dropdown.Item>
                  <Dropdown.Item onClick={() => handleStatusUpdate('SCHEDULED')}>
                    <Clock size={12} className="me-2 text-warning" />
                    Mark as Scheduled
                  </Dropdown.Item>
                  <Dropdown.Item onClick={() => handleStatusUpdate('CANCELLED')}>
                    <XCircle size={12} className="me-2 text-danger" />
                    Mark as Cancelled
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>

              {/* Location Update */}
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setShowLocationModal(true)}
                disabled={loading}
              >
                <MapPin size={14} className="me-1" />
                Location
              </Button>

              {/* Notes Update */}
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setShowNotesModal(true)}
                disabled={loading}
              >
                <FileText size={14} className="me-1" />
                Notes
              </Button>

              {/* Export */}
              <Dropdown>
                <Dropdown.Toggle 
                  variant="outline-secondary" 
                  size="sm" 
                  disabled={loading}
                >
                  <Download size={14} className="me-1" />
                  Export
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item onClick={() => handleExport('csv')}>
                    Export as CSV
                  </Dropdown.Item>
                  <Dropdown.Item onClick={() => handleExport('pdf')}>
                    Export as PDF
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>

              {/* Delete */}
              <Button
                variant="outline-danger"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading}
              >
                <Trash2 size={14} className="me-1" />
                Delete
              </Button>

              {/* Close */}
              <Button
                variant="link"
                size="sm"
                onClick={deselectAll}
                disabled={loading}
                className="text-muted p-1"
              >
                <X size={14} />
              </Button>

              {loading && (
                <Spinner animation="border" size="sm" />
              )}
            </div>
          </Card.Body>
        </Card>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteConfirm} onHide={() => setShowDeleteConfirm(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Delete Shifts</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to delete {selectedCount} shift{selectedCount !== 1 ? 's' : ''}?</p>
          <p className="text-danger small">This action cannot be undone.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={loading}>
            {loading && <Spinner animation="border" size="sm" className="me-2" />}
            Delete {selectedCount} Shift{selectedCount !== 1 ? 's' : ''}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Location Update Modal */}
      <Modal show={showLocationModal} onHide={() => setShowLocationModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Update Location</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Label>New Location</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter location"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
              />
              <Form.Text className="text-muted">
                This will update the location for {selectedCount} selected shift{selectedCount !== 1 ? 's' : ''}.
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowLocationModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleLocationUpdate} 
            disabled={loading || !newLocation.trim()}
          >
            {loading && <Spinner animation="border" size="sm" className="me-2" />}
            Update Location
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Notes Update Modal */}
      <Modal show={showNotesModal} onHide={() => setShowNotesModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Update Notes</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Action</Form.Label>
              <Form.Select 
                value={notesMode} 
                onChange={(e) => setNotesMode(e.target.value as any)}
              >
                <option value="replace">Replace existing notes</option>
                <option value="append">Append to existing notes</option>
                <option value="prepend">Prepend to existing notes</option>
              </Form.Select>
            </Form.Group>
            
            <Form.Group>
              <Form.Label>Notes</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Enter notes"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
              />
              <Form.Text className="text-muted">
                This will {notesMode} notes for {selectedCount} selected shift{selectedCount !== 1 ? 's' : ''}.
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowNotesModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleNotesUpdate} 
            disabled={loading || !newNotes.trim()}
          >
            {loading && <Spinner animation="border" size="sm" className="me-2" />}
            Update Notes
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}