'use client';

import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import Link from 'next/link';
import { TrendingUp, BarChart3, Calendar, CheckSquare } from 'lucide-react';

export default function Home() {
  return (
    <Container fluid className="py-5">
      <Row className="justify-content-center">
        <Col xs={12} className="text-center mb-5">
          <div className="d-flex justify-content-center align-items-center mb-3">
            <TrendingUp size={48} className="text-primary me-3" />
            <h1 className="display-4 fw-bold mb-0">Chrona</h1>
          </div>
          <p className="lead text-muted">
            Your Australian Pay Tracking Companion
          </p>
          <p className="text-muted">
            Track casual pay, forecast earnings, and verify payments with precision
          </p>
        </Col>

        <Col xs={12} md={8} lg={6} className="mb-5">
          <Card className="shadow-lg">
            <Card.Body className="p-4">
              <div className="text-center mb-4">
                <h3 className="fw-bold">Get Started</h3>
                <p className="text-muted mb-4">
                  Ready to take control of your pay tracking?
                </p>
                <Link href="/dashboard">
                  <Button variant="primary" size="lg" className="px-5">
                    Go to Dashboard
                  </Button>
                </Link>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12}>
          <Row className="g-4">
            <Col sm={6} lg={3}>
              <Card className="h-100 shadow-sm">
                <Card.Body className="text-center">
                  <BarChart3 size={36} className="text-primary mb-3" />
                  <h5 className="fw-bold">Dashboard</h5>
                  <p className="text-muted small mb-3">
                    Overview of your current pay period and key metrics
                  </p>
                  <Link href="/dashboard">
                    <Button variant="outline-primary" size="sm">
                      View Dashboard
                    </Button>
                  </Link>
                </Card.Body>
              </Card>
            </Col>

            <Col sm={6} lg={3}>
              <Card className="h-100 shadow-sm">
                <Card.Body className="text-center">
                  <Calendar size={36} className="text-success mb-3" />
                  <h5 className="fw-bold">Shifts</h5>
                  <p className="text-muted small mb-3">
                    Manage your work schedule and track hours
                  </p>
                  <Link href="/shifts">
                    <Button variant="outline-success" size="sm">
                      Manage Shifts
                    </Button>
                  </Link>
                </Card.Body>
              </Card>
            </Col>

            <Col sm={6} lg={3}>
              <Card className="h-100 shadow-sm">
                <Card.Body className="text-center">
                  <TrendingUp size={36} className="text-info mb-3" />
                  <h5 className="fw-bold">Analytics</h5>
                  <p className="text-muted small mb-3">
                    Detailed earnings and hours analysis
                  </p>
                  <Link href="/analytics">
                    <Button variant="outline-info" size="sm">
                      View Analytics
                    </Button>
                  </Link>
                </Card.Body>
              </Card>
            </Col>

            <Col sm={6} lg={3}>
              <Card className="h-100 shadow-sm">
                <Card.Body className="text-center">
                  <CheckSquare size={36} className="text-warning mb-3" />
                  <h5 className="fw-bold">Verification</h5>
                  <p className="text-muted small mb-3">
                    Verify your pay slips against calculations
                  </p>
                  <Link href="/verification">
                    <Button variant="outline-warning" size="sm">
                      Verify Pay
                    </Button>
                  </Link>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Col>

        <Col xs={12} className="text-center mt-5">
          <div className="bg-light rounded p-4">
            <h4 className="fw-bold mb-3">Australian Compliance</h4>
            <p className="text-muted mb-0">
              Built for Australian pay rates, tax brackets, and modern awards. 
              Accurate calculations with HECS-HELP, Medicare levy, and superannuation support.
            </p>
          </div>
        </Col>
      </Row>
    </Container>
  )
}