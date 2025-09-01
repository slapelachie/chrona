'use client';

import { ButtonGroup, Button } from 'react-bootstrap';
import { List, Calendar } from 'lucide-react';

export type ViewType = 'list' | 'calendar';

interface ViewToggleProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  className?: string;
}

export default function ViewToggle({
  currentView,
  onViewChange,
  className = ''
}: ViewToggleProps) {
  return (
    <ButtonGroup className={className}>
      <Button
        variant={currentView === 'list' ? 'primary' : 'outline-primary'}
        onClick={() => onViewChange('list')}
        title="List View"
      >
        <List size={16} />
        <span className="d-none d-sm-inline ms-1">List</span>
      </Button>
      <Button
        variant={currentView === 'calendar' ? 'primary' : 'outline-primary'}
        onClick={() => onViewChange('calendar')}
        title="Calendar View"
      >
        <Calendar size={16} />
        <span className="d-none d-sm-inline ms-1">Calendar</span>
      </Button>
    </ButtonGroup>
  );
}