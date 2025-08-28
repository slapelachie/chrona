'use client';

import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Badge, ProgressBar } from 'react-bootstrap';
import { User, Shield, Award, Clock, DollarSign, Calendar, Download, Trash2 } from 'lucide-react';

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  employmentStatus: string;
  joinDate: string;
  lastActive: string;
  profileCompletion: number;
  statistics: {
    totalShifts: number;
    totalHours: number;
    totalEarnings: number;
    averageHourlyRate: number;
    currentStreak: number;
    longestStreak: number;
  };
  achievements: {
    id: string;
    title: string;
    description: string;
    earnedDate: string;
    icon: string;
  }[];
  dataExport: {
    lastExport: string | null;
    availableFormats: string[];
  };
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      
      // Simulate API call - in real implementation, this would fetch from /api/profile
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock data for demonstration
      const mockProfile: UserProfile = {
        id: 'usr_123456',
        firstName: 'John',
        lastName: 'Smith',
        email: 'john.smith@email.com',
        phone: '0412 345 678',
        dateOfBirth: '1995-06-15',
        employmentStatus: 'casual',
        joinDate: '2024-01-15',
        lastActive: new Date().toISOString(),
        profileCompletion: 85,
        statistics: {
          totalShifts: 142,
          totalHours: 1265,
          totalEarnings: 33420,
          averageHourlyRate: 26.42,
          currentStreak: 7,
          longestStreak: 12
        },
        achievements: [
          {
            id: '1',
            title: 'First Shift',
            description: 'Completed your first shift',
            earnedDate: '2024-01-20',
            icon: '🎉'
          },
          {
            id: '2',
            title: 'Week Warrior',
            description: 'Worked every day for a week',
            earnedDate: '2024-03-15',
            icon: '⚡'
          },
          {
            id: '3',
            title: 'Pay Precision',
            description: 'No pay discrepancies for 3 months',
            earnedDate: '2024-07-01',
            icon: '🎯'
          },
          {
            id: '4',
            title: 'Century Club',
            description: 'Completed 100 shifts',
            earnedDate: '2024-08-10',
            icon: '💯'
          }
        ],
        dataExport: {
          lastExport: '2024-08-01',
          availableFormats: ['PDF', 'Excel', 'CSV']
        }
      };
      
      setProfile(mockProfile);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching profile data:', error);
      setErrorMessage('Failed to load profile');
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    
    try {
      setSaving(true);
      setSuccessMessage('');
      setErrorMessage('');
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setSuccessMessage('Profile updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
      setErrorMessage('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async (format: string) => {
    try {
      setExporting(true);
      
      // Simulate export process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setSuccessMessage(`Data exported to ${format} format successfully`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error exporting data:', error);
      setErrorMessage('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }
    
    try {
      // Simulate API call for account deletion
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      alert('Account deletion requested. You will receive an email confirmation.');
    } catch (error) {
      console.error('Error deleting account:', error);
      setErrorMessage('Failed to delete account');
    }
  };

  const updateProfile = (field: keyof UserProfile, value: string | number) => {
    if (!profile) return;
    
    setProfile({
      ...profile,
      [field]: value
    } as UserProfile);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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

  if (!profile) {
    return (
      <Container fluid className="py-4">
        <Card>
          <Card.Body className="text-center">
            <h5>Profile Not Available</h5>
            <p className="text-muted">Unable to load profile data.</p>
            <Button variant="primary" onClick={fetchProfileData}>
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
              <User size={32} className="text-primary me-3" />
              <div>
                <h1 className="h3 mb-0">Profile</h1>
                <p className="text-muted mb-0">Manage your account and view statistics</p>
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

      <Row>
        <Col lg={8}>
          {/* Profile Information */}
          <Card className="mb-4">
            <Card.Header>
              <div className="d-flex justify-content-between align-items-center">
                <h6 className="mb-0">Profile Information</h6>
                <div>
                  <span className="text-muted me-2">Profile Completion</span>
                  <Badge bg="primary">{profile.profileCompletion}%</Badge>
                </div>
              </div>
              <ProgressBar 
                now={profile.profileCompletion} 
                className="mt-2" 
                style={{ height: '4px' }}
              />
            </Card.Header>
            <Card.Body>
              <Form>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>First Name</Form.Label>
                      <Form.Control
                        type="text"
                        value={profile.firstName}
                        onChange={(e) => updateProfile('firstName', e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Last Name</Form.Label>
                      <Form.Control
                        type="text"
                        value={profile.lastName}
                        onChange={(e) => updateProfile('lastName', e.target.value)}
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
                        value={profile.email}
                        onChange={(e) => updateProfile('email', e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Phone Number</Form.Label>
                      <Form.Control
                        type="tel"
                        value={profile.phone}
                        onChange={(e) => updateProfile('phone', e.target.value)}
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
                        value={profile.dateOfBirth}
                        onChange={(e) => updateProfile('dateOfBirth', e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Employment Status</Form.Label>
                      <Form.Select
                        value={profile.employmentStatus}
                        onChange={(e) => updateProfile('employmentStatus', e.target.value)}
                      >
                        <option value="casual">Casual</option>
                        <option value="part-time">Part-time</option>
                        <option value="full-time">Full-time</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
              </Form>
            </Card.Body>
          </Card>

          {/* Data Export */}
          <Card className="mb-4">
            <Card.Header>
              <h6 className="mb-0">Data Export</h6>
            </Card.Header>
            <Card.Body>
              <p className="text-muted mb-3">
                Export your shift data, earnings, and analytics in various formats.
                {profile.dataExport.lastExport && (
                  <span className="d-block">
                    Last export: {formatDate(profile.dataExport.lastExport)}
                  </span>
                )}
              </p>
              <div className="d-flex gap-2 flex-wrap">
                {profile.dataExport.availableFormats.map((format) => (
                  <Button
                    key={format}
                    variant="outline-primary"
                    size="sm"
                    onClick={() => handleExportData(format)}
                    disabled={exporting}
                  >
                    <Download size={16} className="me-1" />
                    Export {format}
                  </Button>
                ))}
              </div>
            </Card.Body>
          </Card>

          {/* Account Management */}
          <Card className="mb-4">
            <Card.Header>
              <h6 className="mb-0 text-danger">
                <Shield size={16} className="me-1" />
                Account Management
              </h6>
            </Card.Header>
            <Card.Body>
              <p className="text-muted mb-3">
                Permanent account actions. Please be careful as these actions cannot be undone.
              </p>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeleteAccount}
              >
                <Trash2 size={16} className="me-1" />
                Delete Account
              </Button>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          {/* Statistics */}
          <Card className="mb-4">
            <Card.Header>
              <h6 className="mb-0">Career Statistics</h6>
            </Card.Header>
            <Card.Body>
              <div className="text-center p-3 border-bottom">
                <Calendar size={24} className="text-primary mb-2" />
                <div className="h5 fw-bold">{profile.statistics.totalShifts}</div>
                <small className="text-muted">Total Shifts</small>
              </div>
              
              <div className="text-center p-3 border-bottom">
                <Clock size={24} className="text-info mb-2" />
                <div className="h5 fw-bold">{profile.statistics.totalHours}h</div>
                <small className="text-muted">Total Hours Worked</small>
              </div>
              
              <div className="text-center p-3 border-bottom">
                <DollarSign size={24} className="text-success mb-2" />
                <div className="h5 fw-bold">{formatCurrency(profile.statistics.totalEarnings)}</div>
                <small className="text-muted">Total Earnings</small>
              </div>
              
              <div className="text-center p-3 border-bottom">
                <Award size={24} className="text-warning mb-2" />
                <div className="h5 fw-bold">{formatCurrency(profile.statistics.averageHourlyRate)}</div>
                <small className="text-muted">Average Hourly Rate</small>
              </div>
              
              <Row className="text-center mt-3">
                <Col xs={6}>
                  <div className="p-2">
                    <div className="fw-bold text-primary">{profile.statistics.currentStreak}</div>
                    <small className="text-muted">Current Streak</small>
                  </div>
                </Col>
                <Col xs={6}>
                  <div className="p-2">
                    <div className="fw-bold text-success">{profile.statistics.longestStreak}</div>
                    <small className="text-muted">Longest Streak</small>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Achievements */}
          <Card className="mb-4">
            <Card.Header>
              <h6 className="mb-0">Achievements</h6>
            </Card.Header>
            <Card.Body>
              {profile.achievements.map((achievement) => (
                <div key={achievement.id} className="d-flex align-items-start mb-3 p-2 bg-light rounded">
                  <span className="me-3" style={{ fontSize: '1.5rem' }}>
                    {achievement.icon}
                  </span>
                  <div className="flex-grow-1">
                    <div className="fw-bold">{achievement.title}</div>
                    <div className="text-muted small">{achievement.description}</div>
                    <div className="text-muted small">
                      Earned {formatDate(achievement.earnedDate)}
                    </div>
                  </div>
                </div>
              ))}
            </Card.Body>
          </Card>

          {/* Account Info */}
          <Card>
            <Card.Header>
              <h6 className="mb-0">Account Information</h6>
            </Card.Header>
            <Card.Body>
              <div className="mb-2">
                <strong>User ID:</strong> <code>{profile.id}</code>
              </div>
              <div className="mb-2">
                <strong>Member Since:</strong> {formatDate(profile.joinDate)}
              </div>
              <div className="mb-2">
                <strong>Last Active:</strong> {new Date(profile.lastActive).toLocaleString('en-AU')}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}