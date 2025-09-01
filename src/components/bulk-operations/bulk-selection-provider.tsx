'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface BulkSelectionContextType {
  selectedShifts: Set<string>;
  isShiftSelected: (shiftId: string) => boolean;
  selectShift: (shiftId: string) => void;
  deselectShift: (shiftId: string) => void;
  toggleShift: (shiftId: string) => void;
  selectAll: (shiftIds: string[]) => void;
  deselectAll: () => void;
  selectedCount: number;
  isAllSelected: (shiftIds: string[]) => boolean;
  isSomeSelected: (shiftIds: string[]) => boolean;
}

const BulkSelectionContext = createContext<BulkSelectionContextType | null>(null);

export function useBulkSelection() {
  const context = useContext(BulkSelectionContext);
  if (!context) {
    throw new Error('useBulkSelection must be used within a BulkSelectionProvider');
  }
  return context;
}

interface BulkSelectionProviderProps {
  children: React.ReactNode;
}

export default function BulkSelectionProvider({ children }: BulkSelectionProviderProps) {
  const [selectedShifts, setSelectedShifts] = useState<Set<string>>(new Set());

  const isShiftSelected = useCallback((shiftId: string) => {
    return selectedShifts.has(shiftId);
  }, [selectedShifts]);

  const selectShift = useCallback((shiftId: string) => {
    setSelectedShifts(prev => {
      const newSet = new Set(prev);
      newSet.add(shiftId);
      return newSet;
    });
  }, []);

  const deselectShift = useCallback((shiftId: string) => {
    setSelectedShifts(prev => {
      const newSet = new Set(prev);
      newSet.delete(shiftId);
      return newSet;
    });
  }, []);

  const toggleShift = useCallback((shiftId: string) => {
    setSelectedShifts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(shiftId)) {
        newSet.delete(shiftId);
      } else {
        newSet.add(shiftId);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback((shiftIds: string[]) => {
    setSelectedShifts(prev => {
      const newSet = new Set(prev);
      shiftIds.forEach(id => newSet.add(id));
      return newSet;
    });
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedShifts(new Set());
  }, []);

  const isAllSelected = useCallback((shiftIds: string[]) => {
    if (shiftIds.length === 0) return false;
    return shiftIds.every(id => selectedShifts.has(id));
  }, [selectedShifts]);

  const isSomeSelected = useCallback((shiftIds: string[]) => {
    if (shiftIds.length === 0) return false;
    return shiftIds.some(id => selectedShifts.has(id)) && !isAllSelected(shiftIds);
  }, [selectedShifts, isAllSelected]);

  const selectedCount = selectedShifts.size;

  const value = {
    selectedShifts,
    isShiftSelected,
    selectShift,
    deselectShift,
    toggleShift,
    selectAll,
    deselectAll,
    selectedCount,
    isAllSelected,
    isSomeSelected
  };

  return (
    <BulkSelectionContext.Provider value={value}>
      {children}
    </BulkSelectionContext.Provider>
  );
}