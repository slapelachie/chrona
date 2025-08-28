'use client';

import { useState } from 'react';
import { Navbar, Nav, Container, Offcanvas, Button } from 'react-bootstrap';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  BarChart3, 
  Calendar, 
  DollarSign, 
  Settings, 
  Home, 
  Menu,
  CheckSquare,
  TrendingUp,
  User
} from 'lucide-react';

interface NavigationItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  description?: string;
}

export default function Navigation() {
  const [showOffcanvas, setShowOffcanvas] = useState(false);
  const pathname = usePathname();

  const navigationItems: NavigationItem[] = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: <Home size={20} />,
      description: 'Overview and current pay period'
    },
    {
      href: '/shifts',
      label: 'Shifts',
      icon: <Calendar size={20} />,
      description: 'Manage your work schedule'
    },
    {
      href: '/analytics',
      label: 'Analytics',
      icon: <BarChart3 size={20} />,
      description: 'Earnings and hours analysis'
    },
    {
      href: '/verification',
      label: 'Verification',
      icon: <CheckSquare size={20} />,
      description: 'Pay slip verification'
    },
    {
      href: '/settings',
      label: 'Settings',
      icon: <Settings size={20} />,
      description: 'Account and app preferences'
    }
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/' || pathname === '/dashboard';
    }
    return pathname?.startsWith(href);
  };

  const handleCloseOffcanvas = () => setShowOffcanvas(false);

  return (
    <>
      {/* Top Navigation Bar */}
      <Navbar bg="dark" variant="dark" expand="lg" fixed="top" className="shadow-sm">
        <Container fluid>
          <div className="d-flex align-items-center">
            <Button
              variant="outline-light"
              size="sm"
              className="d-lg-none me-3"
              onClick={() => setShowOffcanvas(true)}
            >
              <Menu size={18} />
            </Button>
            
            <Navbar.Brand href="/dashboard" className="d-flex align-items-center">
              <TrendingUp size={24} className="me-2 text-primary" />
              <span className="fw-bold">Chrona</span>
            </Navbar.Brand>
          </div>

          {/* Desktop Navigation */}
          <Nav className="d-none d-lg-flex">
            {navigationItems.map((item) => (
              <Nav.Link
                key={item.href}
                as={Link}
                href={item.href}
                className={`px-3 ${isActive(item.href) ? 'active' : ''}`}
              >
                <div className="d-flex align-items-center">
                  {item.icon}
                  <span className="ms-2">{item.label}</span>
                </div>
              </Nav.Link>
            ))}
          </Nav>

          {/* User Menu */}
          <div className="d-flex align-items-center">
            <Button variant="outline-light" size="sm" className="d-none d-md-block">
              <User size={16} className="me-1" />
              Profile
            </Button>
            <Button variant="outline-light" size="sm" className="d-md-none">
              <User size={16} />
            </Button>
          </div>
        </Container>
      </Navbar>

      {/* Mobile Sidebar Navigation */}
      <Offcanvas 
        show={showOffcanvas} 
        onHide={handleCloseOffcanvas} 
        placement="start"
        className="bg-dark text-light"
      >
        <Offcanvas.Header closeButton closeVariant="white">
          <Offcanvas.Title className="d-flex align-items-center">
            <TrendingUp size={24} className="me-2 text-primary" />
            Chrona
          </Offcanvas.Title>
        </Offcanvas.Header>
        
        <Offcanvas.Body>
          <Nav className="flex-column">
            {navigationItems.map((item) => (
              <Nav.Link
                key={item.href}
                as={Link}
                href={item.href}
                className={`text-light py-3 border-bottom border-secondary ${
                  isActive(item.href) ? 'bg-primary' : ''
                }`}
                onClick={handleCloseOffcanvas}
              >
                <div className="d-flex align-items-start">
                  <div className="me-3 mt-1">{item.icon}</div>
                  <div>
                    <div className="fw-bold">{item.label}</div>
                    {item.description && (
                      <small className="text-muted">{item.description}</small>
                    )}
                  </div>
                </div>
              </Nav.Link>
            ))}
          </Nav>

          {/* Additional Mobile Menu Items */}
          <div className="mt-4 pt-3 border-top border-secondary">
            <Nav className="flex-column">
              <Nav.Link href="/profile" className="text-light py-2">
                <div className="d-flex align-items-center">
                  <User size={18} className="me-3" />
                  Profile Settings
                </div>
              </Nav.Link>
              <Nav.Link href="/help" className="text-light py-2">
                <div className="d-flex align-items-center">
                  <span className="me-3">?</span>
                  Help & Support
                </div>
              </Nav.Link>
            </Nav>
          </div>

          {/* App Version */}
          <div className="mt-auto pt-4 text-center">
            <small className="text-muted">
              Chrona v1.0.0<br />
              Australian Pay Tracker
            </small>
          </div>
        </Offcanvas.Body>
      </Offcanvas>

      {/* Bottom Navigation (Mobile Only) */}
      <div className="d-lg-none fixed-bottom bg-dark border-top border-secondary">
        <div className="container-fluid">
          <div className="row text-center">
            {navigationItems.slice(0, 5).map((item) => (
              <div key={item.href} className="col">
                <Link
                  href={item.href}
                  className={`d-block py-2 text-decoration-none ${
                    isActive(item.href) ? 'text-primary' : 'text-light'
                  }`}
                >
                  <div className="d-flex flex-column align-items-center">
                    {item.icon}
                    <small className="mt-1" style={{ fontSize: '0.7rem' }}>
                      {item.label}
                    </small>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add padding to body to account for fixed navigation */}
      <style jsx global>{`
        body {
          padding-top: 56px; /* Height of navbar */
          padding-bottom: 70px; /* Height of bottom nav on mobile */
        }

        @media (min-width: 992px) {
          body {
            padding-bottom: 0;
          }
        }

        .navbar-brand:hover {
          text-decoration: none;
        }

        .nav-link.active {
          color: var(--bs-primary) !important;
          background-color: rgba(var(--bs-primary-rgb), 0.1);
          border-radius: 0.375rem;
        }

        .offcanvas .nav-link:hover {
          background-color: rgba(255, 255, 255, 0.1);
          border-radius: 0.375rem;
        }

        .fixed-bottom .nav-link:hover {
          background-color: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </>
  );
}