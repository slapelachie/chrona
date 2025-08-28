'use client';

import { useState } from 'react';
import { Container, Row, Col, Card, Accordion, Alert, Form, Button, Nav } from 'react-bootstrap';
import { HelpCircle, BookOpen, MessageSquare, Mail, Phone, Search, ExternalLink } from 'lucide-react';

interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  helpful: boolean;
}

export default function HelpPage() {
  const [activeTab, setActiveTab] = useState('faq');
  const [searchQuery, setSearchQuery] = useState('');
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const faqData: FAQItem[] = [
    {
      id: '1',
      category: 'Getting Started',
      question: 'How do I add my first shift?',
      answer: 'Navigate to the Shifts page and click "Add Shift". Enter your shift start/end times, select any breaks, and choose the appropriate shift type (regular, overtime, penalty). The app will automatically calculate your pay based on your selected pay guide.',
      helpful: false
    },
    {
      id: '2',
      category: 'Getting Started',
      question: 'How do I set up my pay guide?',
      answer: 'Go to Settings > Pay Settings and select your appropriate award from the dropdown. If you can\'t find your specific award, choose "Custom Pay Rates" and enter your base hourly rate and penalty rates manually.',
      helpful: false
    },
    {
      id: '3',
      category: 'Pay Calculations',
      question: 'How are overtime rates calculated?',
      answer: 'Overtime is typically calculated at 1.5x your base rate after 8 hours per day or 38 hours per week, depending on your award. Weekend and public holiday penalties may apply on top of overtime rates. Check your specific award for exact rules.',
      helpful: false
    },
    {
      id: '4',
      category: 'Pay Calculations',
      question: 'What is casual loading and how is it applied?',
      answer: 'Casual loading is typically 25% of your base rate, added to compensate for lack of leave entitlements. This is automatically applied to all hours if you\'ve set your employment status to "Casual" in your profile.',
      helpful: false
    },
    {
      id: '5',
      category: 'Tax & Deductions',
      question: 'How accurate are the tax calculations?',
      answer: 'Tax calculations use current Australian tax brackets, Medicare levy (2%), and HECS repayment rates if applicable. However, these are estimates and may not account for all personal circumstances. Always verify against your actual payslip.',
      helpful: false
    },
    {
      id: '6',
      category: 'Tax & Deductions',
      question: 'Can I include HECS debt in calculations?',
      answer: 'Yes! In Settings > Pay Settings, check the "HECS-HELP Debt" option. This will include HECS repayment calculations based on your income level and current repayment rates.',
      helpful: false
    },
    {
      id: '7',
      category: 'Pay Verification',
      question: 'How do I verify my payslip?',
      answer: 'Go to Verification and create a new verification by entering your actual pay amounts from your payslip. The app will compare these against calculated amounts and highlight any discrepancies.',
      helpful: false
    },
    {
      id: '8',
      category: 'Pay Verification',
      question: 'What should I do if there\'s a pay discrepancy?',
      answer: 'First, check if you\'ve entered all shifts correctly and your pay guide is accurate. If the discrepancy persists, contact your employer with the detailed breakdown from Chrona. Keep records of the discrepancy for follow-up.',
      helpful: false
    },
    {
      id: '9',
      category: 'Data & Privacy',
      question: 'Is my data secure?',
      answer: 'Yes, all your data is stored locally on your device by default. For the web version, data is encrypted and stored securely. We never share your personal or financial information with third parties.',
      helpful: false
    },
    {
      id: '10',
      category: 'Data & Privacy',
      question: 'Can I export my data?',
      answer: 'Absolutely! Go to Profile > Data Export to download your shifts, earnings, and analytics in PDF, Excel, or CSV format. This is useful for tax time or switching to another system.',
      helpful: false
    }
  ];

  const filteredFAQs = faqData.filter(faq => 
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories = [...new Set(faqData.map(faq => faq.category))];

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate form submission
    alert('Thank you for your message! We\'ll get back to you within 1-2 business days.');
    setContactForm({
      name: '',
      email: '',
      subject: '',
      message: ''
    });
  };

  const updateContactForm = (field: string, value: string) => {
    setContactForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Container fluid className="py-4">
      {/* Page Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex align-items-center">
            <HelpCircle size={32} className="text-primary me-3" />
            <div>
              <h1 className="h3 mb-0">Help & Support</h1>
              <p className="text-muted mb-0">Get help with using Chrona</p>
            </div>
          </div>
        </Col>
      </Row>

      {/* Navigation Tabs */}
      <Row className="mb-4">
        <Col>
          <Nav variant="tabs" activeKey={activeTab} onSelect={(k) => setActiveTab(k || 'faq')}>
            <Nav.Item>
              <Nav.Link eventKey="faq">
                <BookOpen size={16} className="me-1" />
                FAQ
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="guides">
                <BookOpen size={16} className="me-1" />
                Guides
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="contact">
                <MessageSquare size={16} className="me-1" />
                Contact
              </Nav.Link>
            </Nav.Item>
          </Nav>
        </Col>
      </Row>

      {/* FAQ Tab */}
      {activeTab === 'faq' && (
        <>
          {/* Search */}
          <Row className="mb-4">
            <Col lg={6}>
              <Form.Group>
                <div className="position-relative">
                  <Form.Control
                    type="text"
                    placeholder="Search FAQs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="ps-5"
                  />
                  <Search size={18} className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" />
                </div>
              </Form.Group>
            </Col>
          </Row>

          {/* FAQ Content */}
          <Row>
            <Col lg={9}>
              {categories.map((category) => {
                const categoryFAQs = filteredFAQs.filter(faq => faq.category === category);
                if (categoryFAQs.length === 0) return null;

                return (
                  <Card key={category} className="mb-4">
                    <Card.Header>
                      <h5 className="mb-0">{category}</h5>
                    </Card.Header>
                    <Card.Body className="p-0">
                      <Accordion flush>
                        {categoryFAQs.map((faq) => (
                          <Accordion.Item key={faq.id} eventKey={faq.id}>
                            <Accordion.Header>
                              {faq.question}
                            </Accordion.Header>
                            <Accordion.Body>
                              <div className="mb-3">{faq.answer}</div>
                              <div className="d-flex justify-content-between align-items-center">
                                <span className="text-muted small">Was this helpful?</span>
                                <div>
                                  <Button variant="outline-success" size="sm" className="me-2">
                                    👍 Yes
                                  </Button>
                                  <Button variant="outline-danger" size="sm">
                                    👎 No
                                  </Button>
                                </div>
                              </div>
                            </Accordion.Body>
                          </Accordion.Item>
                        ))}
                      </Accordion>
                    </Card.Body>
                  </Card>
                );
              })}

              {filteredFAQs.length === 0 && (
                <Card>
                  <Card.Body className="text-center py-5">
                    <Search size={48} className="text-muted mb-3" />
                    <h5>No results found</h5>
                    <p className="text-muted">Try different search terms or browse all FAQs.</p>
                    <Button variant="outline-primary" onClick={() => setSearchQuery('')}>
                      Show All FAQs
                    </Button>
                  </Card.Body>
                </Card>
              )}
            </Col>

            <Col lg={3}>
              <Card>
                <Card.Header>
                  <h6 className="mb-0">Quick Links</h6>
                </Card.Header>
                <Card.Body>
                  <div className="d-grid gap-2">
                    <Button variant="outline-primary" size="sm" onClick={() => setActiveTab('guides')}>
                      <BookOpen size={16} className="me-1" />
                      User Guides
                    </Button>
                    <Button variant="outline-info" size="sm" onClick={() => setActiveTab('contact')}>
                      <MessageSquare size={16} className="me-1" />
                      Contact Support
                    </Button>
                    <Button 
                      variant="outline-secondary" 
                      size="sm" 
                      href="https://www.fairwork.gov.au" 
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink size={16} className="me-1" />
                      Fair Work Australia
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* Guides Tab */}
      {activeTab === 'guides' && (
        <Row>
          <Col lg={8}>
            <Row>
              <Col md={6} className="mb-4">
                <Card className="h-100">
                  <Card.Body>
                    <div className="d-flex align-items-start">
                      <BookOpen size={32} className="text-primary me-3 mt-1" />
                      <div>
                        <h5>Getting Started Guide</h5>
                        <p className="text-muted">
                          Complete walkthrough for new users, from setup to your first shift.
                        </p>
                        <Button variant="outline-primary" size="sm">
                          Read Guide
                        </Button>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              
              <Col md={6} className="mb-4">
                <Card className="h-100">
                  <Card.Body>
                    <div className="d-flex align-items-start">
                      <BookOpen size={32} className="text-success me-3 mt-1" />
                      <div>
                        <h5>Pay Calculation Guide</h5>
                        <p className="text-muted">
                          Understanding how overtime, penalties, and casual loading work.
                        </p>
                        <Button variant="outline-success" size="sm">
                          Read Guide
                        </Button>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              
              <Col md={6} className="mb-4">
                <Card className="h-100">
                  <Card.Body>
                    <div className="d-flex align-items-start">
                      <BookOpen size={32} className="text-info me-3 mt-1" />
                      <div>
                        <h5>Tax & HECS Guide</h5>
                        <p className="text-muted">
                          Australian tax system, HECS repayments, and deduction calculations.
                        </p>
                        <Button variant="outline-info" size="sm">
                          Read Guide
                        </Button>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              
              <Col md={6} className="mb-4">
                <Card className="h-100">
                  <Card.Body>
                    <div className="d-flex align-items-start">
                      <BookOpen size={32} className="text-warning me-3 mt-1" />
                      <div>
                        <h5>Verification Guide</h5>
                        <p className="text-muted">
                          How to verify your payslips and handle discrepancies.
                        </p>
                        <Button variant="outline-warning" size="sm">
                          Read Guide
                        </Button>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Col>
        </Row>
      )}

      {/* Contact Tab */}
      {activeTab === 'contact' && (
        <Row>
          <Col lg={8}>
            <Card>
              <Card.Header>
                <h6 className="mb-0">Contact Support</h6>
              </Card.Header>
              <Card.Body>
                <Alert variant="info">
                  <strong>Before contacting support:</strong> Please check the FAQ section above as most common questions are answered there.
                </Alert>

                <Form onSubmit={handleContactSubmit}>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Name</Form.Label>
                        <Form.Control
                          type="text"
                          value={contactForm.name}
                          onChange={(e) => updateContactForm('name', e.target.value)}
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Email</Form.Label>
                        <Form.Control
                          type="email"
                          value={contactForm.email}
                          onChange={(e) => updateContactForm('email', e.target.value)}
                          required
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  
                  <Form.Group className="mb-3">
                    <Form.Label>Subject</Form.Label>
                    <Form.Select
                      value={contactForm.subject}
                      onChange={(e) => updateContactForm('subject', e.target.value)}
                      required
                    >
                      <option value="">Select a subject...</option>
                      <option value="bug">Bug Report</option>
                      <option value="feature">Feature Request</option>
                      <option value="pay-calculation">Pay Calculation Issue</option>
                      <option value="account">Account Issue</option>
                      <option value="general">General Question</option>
                      <option value="other">Other</option>
                    </Form.Select>
                  </Form.Group>
                  
                  <Form.Group className="mb-3">
                    <Form.Label>Message</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={5}
                      value={contactForm.message}
                      onChange={(e) => updateContactForm('message', e.target.value)}
                      placeholder="Please provide as much detail as possible..."
                      required
                    />
                  </Form.Group>
                  
                  <Button type="submit" variant="primary">
                    <Mail size={16} className="me-1" />
                    Send Message
                  </Button>
                </Form>
              </Card.Body>
            </Card>
          </Col>
          
          <Col lg={4}>
            <Card>
              <Card.Header>
                <h6 className="mb-0">Other Ways to Get Help</h6>
              </Card.Header>
              <Card.Body>
                <div className="mb-3">
                  <div className="d-flex align-items-center mb-2">
                    <Mail size={20} className="text-primary me-2" />
                    <strong>Email Support</strong>
                  </div>
                  <div className="text-muted small">
                    support@chrona.app<br />
                    Response within 1-2 business days
                  </div>
                </div>
                
                <div className="mb-3">
                  <div className="d-flex align-items-center mb-2">
                    <Phone size={20} className="text-success me-2" />
                    <strong>Phone Support</strong>
                  </div>
                  <div className="text-muted small">
                    1300 CHRONA (247-662)<br />
                    Mon-Fri 9AM-5PM AEST
                  </div>
                </div>
                
                <div className="mb-3">
                  <div className="d-flex align-items-center mb-2">
                    <ExternalLink size={20} className="text-info me-2" />
                    <strong>Online Resources</strong>
                  </div>
                  <div className="small">
                    <a href="https://www.fairwork.gov.au" target="_blank" rel="noopener noreferrer" className="text-decoration-none">
                      Fair Work Australia
                    </a><br />
                    <a href="https://www.ato.gov.au" target="_blank" rel="noopener noreferrer" className="text-decoration-none">
                      Australian Taxation Office
                    </a>
                  </div>
                </div>
              </Card.Body>
            </Card>

            <Card className="mt-3">
              <Card.Body className="text-center">
                <h6>Enjoying Chrona?</h6>
                <p className="text-muted small">
                  Help us improve by leaving feedback or rating the app.
                </p>
                <Button variant="outline-primary" size="sm">
                  Leave Feedback
                </Button>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </Container>
  );
}