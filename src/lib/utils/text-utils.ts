import React from 'react';

export function highlightSearchTerms(text: string | null, searchTerm?: string): React.ReactNode {
  if (!text || !searchTerm || !searchTerm.trim()) {
    return text;
  }

  // Clean search term and split into words
  const terms = searchTerm.toLowerCase().split(' ').filter(term => term.length > 0);
  if (terms.length === 0) return text;

  // Create regex pattern for all search terms
  const pattern = new RegExp(`(${terms.map(term => 
    term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex characters
  ).join('|')})`, 'gi');

  const parts = text.split(pattern);
  
  return parts.map((part, index) => {
    const isMatch = terms.some(term => 
      part.toLowerCase().includes(term.toLowerCase())
    );
    
    return isMatch ? 
      React.createElement('mark', {
        key: index,
        className: 'bg-warning bg-opacity-50 rounded px-1'
      }, part) : part;
  });
}

export function extractSearchableText(shift: any): string {
  const searchableFields = [
    shift.notes,
    shift.location,
    shift.shiftType,
    shift.payGuide?.name
  ];

  return searchableFields
    .filter(field => field)
    .join(' ')
    .toLowerCase();
}