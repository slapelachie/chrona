'use client';

import { useState, useEffect, useRef } from 'react';
import { Form, InputGroup, Button, Dropdown, ListGroup } from 'react-bootstrap';
import { Search, X, Clock } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
  className?: string;
}

interface SearchSuggestion {
  text: string;
  type: 'recent' | 'suggestion';
  category?: 'location' | 'notes' | 'type';
}

export default function SearchBar({
  value,
  onChange,
  onClear,
  placeholder = "Search shifts by location, notes, or type...",
  className = ''
}: SearchBarProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('chrona-recent-searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to parse recent searches:', error);
      }
    }
  }, []);

  // Save search when user searches
  const saveSearch = (searchTerm: string) => {
    if (!searchTerm.trim() || searchTerm.length < 2) return;
    
    const updated = [searchTerm, ...recentSearches.filter(s => s !== searchTerm)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('chrona-recent-searches', JSON.stringify(updated));
  };

  // Generate suggestions based on input
  const generateSuggestions = (input: string): SearchSuggestion[] => {
    if (!input.trim()) {
      return recentSearches.map(search => ({
        text: search,
        type: 'recent' as const
      }));
    }

    const suggestions: SearchSuggestion[] = [];
    const inputLower = input.toLowerCase();

    // Add recent searches that match
    recentSearches
      .filter(search => search.toLowerCase().includes(inputLower))
      .forEach(search => {
        suggestions.push({
          text: search,
          type: 'recent'
        });
      });

    // Add predefined suggestions
    const predefinedSuggestions = [
      // Location suggestions
      { text: 'location:"Store A"', category: 'location' as const },
      { text: 'location:"Store B"', category: 'location' as const },
      { text: 'location:"Head Office"', category: 'location' as const },
      
      // Type suggestions
      { text: 'type:regular', category: 'type' as const },
      { text: 'type:overtime', category: 'type' as const },
      { text: 'type:weekend', category: 'type' as const },
      { text: 'type:public_holiday', category: 'type' as const },
      
      // Common note terms
      { text: 'urgent', category: 'notes' as const },
      { text: 'extra', category: 'notes' as const },
      { text: 'training', category: 'notes' as const },
      { text: 'meeting', category: 'notes' as const }
    ];

    predefinedSuggestions
      .filter(suggestion => suggestion.text.toLowerCase().includes(inputLower))
      .forEach(suggestion => {
        suggestions.push({
          text: suggestion.text,
          type: 'suggestion',
          category: suggestion.category
        });
      });

    return suggestions.slice(0, 8); // Limit to 8 suggestions
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    const newSuggestions = generateSuggestions(newValue);
    setSuggestions(newSuggestions);
    setShowSuggestions(true);
  };

  const handleInputFocus = () => {
    const newSuggestions = generateSuggestions(value);
    setSuggestions(newSuggestions);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    onChange(suggestion.text);
    saveSearch(suggestion.text);
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      saveSearch(value.trim());
    }
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    onClear();
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'location': return '📍';
      case 'notes': return '📝';
      case 'type': return '🏷️';
      default: return '🔍';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <div className={`position-relative ${className}`}>
      <InputGroup>
        <InputGroup.Text>
          <Search size={16} className="text-muted" />
        </InputGroup.Text>
        <Form.Control
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          className="border-start-0"
        />
          {value && (
            <Button
              variant="outline-secondary"
              onClick={handleClear}
              className="border-start-0"
            >
              <X size={16} />
            </Button>
          )}
      </InputGroup>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="position-absolute w-100 mt-1 bg-white border rounded shadow-sm"
          style={{ zIndex: 1050 }}
        >
          <ListGroup variant="flush">
            {suggestions.map((suggestion, index) => (
              <ListGroup.Item
                key={index}
                action
                onClick={() => handleSuggestionClick(suggestion)}
                className="d-flex align-items-center py-2 px-3"
                style={{ cursor: 'pointer' }}
              >
                <span className="me-2">
                  {suggestion.type === 'recent' ? (
                    <Clock size={14} className="text-muted" />
                  ) : (
                    <span>{getCategoryIcon(suggestion.category)}</span>
                  )}
                </span>
                <span className="flex-grow-1">{suggestion.text}</span>
                {suggestion.type === 'recent' && (
                  <small className="text-muted ms-2">Recent</small>
                )}
              </ListGroup.Item>
            ))}
          </ListGroup>
          
          {recentSearches.length > 0 && (
            <div className="border-top p-2">
              <Button
                variant="link"
                size="sm"
                className="text-muted p-0"
                onClick={() => {
                  setRecentSearches([]);
                  localStorage.removeItem('chrona-recent-searches');
                  setShowSuggestions(false);
                }}
              >
                Clear search history
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}