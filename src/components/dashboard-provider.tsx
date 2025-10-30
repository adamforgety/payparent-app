'use client';

import React, { createContext, useContext } from 'react';
import type { Expense, ChildSupport } from '@/lib/types';

interface DashboardContextType {
  onUpdateExpense: (expense: Expense) => void;
  onUpdateChildSupport: (childSupport: ChildSupport) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider: React.FC<{
  children: React.ReactNode;
  onUpdateExpense: (expense: Expense) => void;
  onUpdateChildSupport: (childSupport: ChildSupport) => void;
}> = ({ children, onUpdateExpense, onUpdateChildSupport }) => {
  return (
    <DashboardContext.Provider value={{ onUpdateExpense, onUpdateChildSupport }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = (): DashboardContextType => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};
