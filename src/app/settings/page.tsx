'use client';

import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Nav } from 'react-bootstrap';
import { Settings, User, DollarSign, Bell, ExternalLink, Plus } from 'lucide-react';

interface PayGuide {
  id: string;
  name: string;
  baseHourlyRate: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
}

interface SettingsData {
  personal: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
  };
  paySettings: {
    defaultPayGuideId: string;
    lastUsedPayGuideId: string;
    tfnProvided: boolean;
    hecsDebt: boolean;
    superFund: string;
    superMemberNumber: string;
  };
  notifications: {
    shiftReminders: boolean;
    payDayAlerts: boolean;
    discrepancyAlerts: boolean;
    weeklyReports: boolean;
  };
  preferences: {
    theme: string;
    currency: string;
    dateFormat: string;
    timeFormat: string;
  };
}

export default function SettingsPage() {
  const [settingsData, setSettingsData] = useState<SettingsData | null>(null);
  const [payGuides, setPayGuides] = useState<PayGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchSettingsData();
  }, []);

  const fetchSettingsData = async () => {
    try {
      setLoading(true);
      
      // Fetch user preferences and pay guides
      const [preferencesResponse, payGuidesResponse] = await Promise.all([
        fetch('/api/user/preferences'),
        fetch('/api/pay-rates')
      ]);

      if (!preferencesResponse.ok || !payGuidesResponse.ok) {
        throw new Error('Failed to fetch data');
      }

      const preferences = await preferencesResponse.json();
      const payGuidesData = await payGuidesResponse.json();

      // Transform the data to match the interface
      const mockData: SettingsData = {
        personal: {
          firstName: 'John',
          lastName: 'Smith',
          email: 'john.smith@email.com',
          phone: '0412 345 678',
          dateOfBirth: '1995-06-15'
        },
        paySettings: {
          defaultPayGuideId: preferences.defaultPayGuideId || '',
          lastUsedPayGuideId: preferences.lastUsedPayGuideId || '',
          tfnProvided: preferences.taxSettings?.claimsTaxFreeThreshold || false,
          hecsDebt: preferences.taxSettings?.hasHECSDebt || false,
          superFund: 'Australian Super',
          superMemberNumber: 'AS123456789'
        },
        notifications: {
          shiftReminders: true,
          payDayAlerts: true,
          discrepancyAlerts: true,
          weeklyReports: false
        },
        preferences: {
          theme: 'dark',
          currency: 'AUD',
          dateFormat: 'dd/MM/yyyy',
          timeFormat: '24h'
        }
      };
      
      setSettingsData(mockData);
      setPayGuides(payGuidesData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching settings data:', error);
      setErrorMessage('Failed to load settings');
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settingsData) return;
    
    try {
      setSaving(true);
      setSuccessMessage('');
      setErrorMessage('');
      
      // Save user preferences
      const preferencesData = {
        defaultPayGuideId: settingsData.paySettings.defaultPayGuideId,
        lastUsedPayGuideId: settingsData.paySettings.lastUsedPayGuideId,
        taxSettings: {
          claimsTaxFreeThreshold: settingsData.paySettings.tfnProvided,
          hasHECSDebt: settingsData.paySettings.hecsDebt
        }
      };

      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferencesData)
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }
      
      setSuccessMessage('Settings saved successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setErrorMessage('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (section: keyof SettingsData, field: string, value: string | boolean) => {
    if (!settingsData) return;
    
    setSettingsData({
      ...settingsData,
      [section]: {
        ...settingsData[section],
        [field]: value
      }
    } as SettingsData);
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

  if (!settingsData) {
    return (
      <Container fluid className="py-4">
        <Card>
          <Card.Body className="text-center">
            <h5>Settings Not Available</h5>
            <p className="text-muted">Unable to load settings data.</p>
            <Button variant="primary" onClick={fetchSettingsData}>
              Retry
            </Button>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4">
      {/* Page Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center">
              <Settings size={32} className="text-primary me-3" />
              <div>
                <h1 className="h3 mb-0">Settings</h1>
                <p className="text-muted mb-0">Manage your account and preferences</p>
              </div>
            </div>
            <Button 
              variant="primary" 
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </Col>
      </Row>

      {/* Success/Error Messages */}
      {successMessage && (
        <Row className="mb-3">
          <Col>
            <Alert variant="success">{successMessage}</Alert>
          </Col>
        </Row>
      )}
      
      {errorMessage && (
        <Row className="mb-3">
          <Col>
            <Alert variant="danger">{errorMessage}</Alert>
          </Col>
        </Row>
      )}

      {/* Navigation Tabs */}
      <Row className="mb-4">
        <Col>
          <Nav variant="tabs" activeKey={activeTab} onSelect={(k) => setActiveTab(k || 'personal')}>
            <Nav.Item>
              <Nav.Link eventKey="personal">
                <User size={16} className="me-1" />
                Personal
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="pay">
                <DollarSign size={16} className="me-1" />
                Pay Settings
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="notifications">
                <Bell size={16} className="me-1" />
                Notifications
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="preferences">
                <Settings size={16} className="me-1" />
                Preferences
              </Nav.Link>
            </Nav.Item>
          </Nav>
        </Col>
      </Row>

      {/* Personal Settings Tab */}
      {activeTab === 'personal' && (
        <Row>
          <Col lg={8}>
            <Card>
              <Card.Header>
                <h6 className="mb-0">Personal Information</h6>
              </Card.Header>
              <Card.Body>
                <Form>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>First Name</Form.Label>
                        <Form.Control
                          type="text"
                          value={settingsData.personal.firstName}
                          onChange={(e) => updateSettings('personal', 'firstName', e.target.value)}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Last Name</Form.Label>
                        <Form.Control
                          type="text"
                          value={settingsData.personal.lastName}
                          onChange={(e) => updateSettings('personal', 'lastName', e.target.value)}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Email Address</Form.Label>
                        <Form.Control
                          type="email"
                          value={settingsData.personal.email}
                          onChange={(e) => updateSettings('personal', 'email', e.target.value)}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Phone Number</Form.Label>
                        <Form.Control
                          type="tel"
                          value={settingsData.personal.phone}
                          onChange={(e) => updateSettings('personal', 'phone', e.target.value)}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Date of Birth</Form.Label>
                        <Form.Control
                          type="date"
                          value={settingsData.personal.dateOfBirth}
                          onChange={(e) => updateSettings('personal', 'dateOfBirth', e.target.value)}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                </Form>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Pay Settings Tab */}
      {activeTab === 'pay' && (
        <Row>
          <Col lg={8}>
            <Card className="mb-4">
              <Card.Header>
                <h6 className="mb-0">Pay Guide & Tax Settings</h6>
              </Card.Header>
              <Card.Body>
                <Form>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Default Pay Guide</Form.Label>
                        <Form.Select
                          value={settingsData.paySettings.defaultPayGuideId}
                          onChange={(e) => updateSettings('paySettings', 'defaultPayGuideId', e.target.value)}
                        >
                          <option value="">Select a default pay guide...</option>
                          {payGuides.map(guide => (
                            <option key={guide.id} value={guide.id}>
                              {guide.name} - ${parseFloat(guide.baseHourlyRate).toFixed(2)}/hr
                            </option>
                          ))}
                        </Form.Select>
                        <Form.Text className="text-muted">
                          Default pay guide for new shifts when none is specified
                        </Form.Text>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Last Used Pay Guide</Form.Label>
                        <Form.Control
                          type="text"
                          value={payGuides.find(g => g.id === settingsData.paySettings.lastUsedPayGuideId)?.name || 'None'}
                          disabled
                        />
                        <Form.Text className="text-muted">
                          Automatically updated when creating shifts
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>
                  
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div>
                      <h6 className="mb-0">Pay Guide Management</h6>
                      <small className="text-muted">Manage your pay guides and award rates</small>
                    </div>
                    <Button 
                      variant="primary" 
                      size="sm"
                      onClick={() => window.open('/pay-rates', '_blank')}
                    >
                      <Plus size={16} className="me-1" />
                      Manage Pay Guides
                      <ExternalLink size={14} className="ms-1" />
                    </Button>
                  </div>
                  
                  {payGuides.length > 0 ? (
                    <div className="p-3 bg-light rounded mb-3">
                      <div className="row">
                        <div className="col-12">
                          <small className="text-muted fw-bold">Your Pay Guides ({payGuides.length})</small>
                        </div>
                      </div>
                      <div className="row mt-2">
                        {payGuides.slice(0, 3).map((guide) => (
                          <div key={guide.id} className="col-md-4">
                            <div className="small">
                              <div className="fw-bold">{guide.name}</div>
                              <div className="text-success">${parseFloat(guide.baseHourlyRate).toFixed(2)}/hr</div>
                              <div className="text-muted">
                                {guide.isActive ? 'Active' : 'Inactive'}
                                {guide.id === settingsData.paySettings.defaultPayGuideId && ' (Default)'}
                                {guide.id === settingsData.paySettings.lastUsedPayGuideId && ' (Last Used)'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {payGuides.length > 3 && (
                        <div className="text-center mt-2">
                          <small className="text-muted">
                            +{payGuides.length - 3} more pay guides
                          </small>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Alert variant="info" className="mb-3">
                      <div className="d-flex align-items-center">
                        <DollarSign size={20} className="me-2" />
                        <div>
                          <strong>No pay guides found</strong>
                          <div className="small">Create your first pay guide to get started with accurate pay calculations.</div>
                        </div>
                      </div>
                    </Alert>
                  )}
                  
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Check
                          type="checkbox"
                          label="Tax File Number Provided to Employer"
                          checked={settingsData.paySettings.tfnProvided}
                          onChange={(e) => updateSettings('paySettings', 'tfnProvided', e.target.checked)}
                        />
                        <Form.Text className="text-muted">
                          Affects tax rate calculations (higher rate if TFN not provided)
                        </Form.Text>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Check
                          type="checkbox"
                          label="HECS-HELP Debt"
                          checked={settingsData.paySettings.hecsDebt}
                          onChange={(e) => updateSettings('paySettings', 'hecsDebt', e.target.checked)}
                        />
                        <Form.Text className="text-muted">
                          Includes HECS repayment in tax calculations
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>
                </Form>
              </Card.Body>
            </Card>

            <Card>
              <Card.Header>
                <h6 className="mb-0">Superannuation Details</h6>
              </Card.Header>
              <Card.Body>
                <Form>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Superannuation Fund</Form.Label>
                        <Form.Control
                          type="text"
                          value={settingsData.paySettings.superFund}
                          onChange={(e) => updateSettings('paySettings', 'superFund', e.target.value)}
                          placeholder="e.g., Australian Super"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Member Number</Form.Label>
                        <Form.Control
                          type="text"
                          value={settingsData.paySettings.superMemberNumber}
                          onChange={(e) => updateSettings('paySettings', 'superMemberNumber', e.target.value)}
                          placeholder="Your super member number"
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                </Form>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <Row>
          <Col lg={6}>
            <Card>
              <Card.Header>
                <h6 className="mb-0">Notification Preferences</h6>
              </Card.Header>
              <Card.Body>
                <Form>
                  <Form.Group className="mb-3">
                    <Form.Check
                      type="checkbox"
                      label="Shift Reminders"
                      checked={settingsData.notifications.shiftReminders}
                      onChange={(e) => updateSettings('notifications', 'shiftReminders', e.target.checked)}
                    />
                    <Form.Text className="text-muted">
                      Get notified 1 hour before scheduled shifts
                    </Form.Text>
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Check
                      type="checkbox"
                      label="Pay Day Alerts"
                      checked={settingsData.notifications.payDayAlerts}
                      onChange={(e) => updateSettings('notifications', 'payDayAlerts', e.target.checked)}
                    />
                    <Form.Text className="text-muted">
                      Reminders when your pay is due
                    </Form.Text>
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Check
                      type="checkbox"
                      label="Discrepancy Alerts"
                      checked={settingsData.notifications.discrepancyAlerts}
                      onChange={(e) => updateSettings('notifications', 'discrepancyAlerts', e.target.checked)}
                    />
                    <Form.Text className="text-muted">
                      Notify when pay verification finds discrepancies
                    </Form.Text>
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Check
                      type="checkbox"
                      label="Weekly Reports"
                      checked={settingsData.notifications.weeklyReports}
                      onChange={(e) => updateSettings('notifications', 'weeklyReports', e.target.checked)}
                    />
                    <Form.Text className="text-muted">
                      Weekly summary of hours and earnings
                    </Form.Text>
                  </Form.Group>
                </Form>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Preferences Tab */}
      {activeTab === 'preferences' && (
        <Row>
          <Col lg={6}>
            <Card>
              <Card.Header>
                <h6 className="mb-0">App Preferences</h6>
              </Card.Header>
              <Card.Body>
                <Form>
                  <Form.Group className="mb-3">
                    <Form.Label>Theme</Form.Label>
                    <Form.Select
                      value={settingsData.preferences.theme}
                      onChange={(e) => updateSettings('preferences', 'theme', e.target.value)}
                    >
                      <option value="dark">Dark (Default)</option>
                      <option value="light">Light</option>
                      <option value="system">Follow System</option>
                    </Form.Select>
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Currency</Form.Label>
                    <Form.Select
                      value={settingsData.preferences.currency}
                      onChange={(e) => updateSettings('preferences', 'currency', e.target.value)}
                    >
                      <option value="AUD">Australian Dollar (AUD)</option>
                      <option value="USD">US Dollar (USD)</option>
                      <option value="EUR">Euro (EUR)</option>
                    </Form.Select>
                  </Form.Group>

                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Date Format</Form.Label>
                        <Form.Select
                          value={settingsData.preferences.dateFormat}
                          onChange={(e) => updateSettings('preferences', 'dateFormat', e.target.value)}
                        >
                          <option value="dd/MM/yyyy">DD/MM/YYYY (Australian)</option>
                          <option value="MM/dd/yyyy">MM/DD/YYYY (US)</option>
                          <option value="yyyy-MM-dd">YYYY-MM-DD (ISO)</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Time Format</Form.Label>
                        <Form.Select
                          value={settingsData.preferences.timeFormat}
                          onChange={(e) => updateSettings('preferences', 'timeFormat', e.target.value)}
                        >
                          <option value="24h">24 Hour (14:30)</option>
                          <option value="12h">12 Hour (2:30 PM)</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>
                </Form>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </Container>
  );
}