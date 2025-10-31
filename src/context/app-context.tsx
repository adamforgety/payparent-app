'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { AppData } from '@/lib/types';
import { initialData } from '@/lib/data';

const LOCAL_STORAGE_KEY = 'payparent_app_data';

interface AppContextType {
  appData: AppData | null;
  updateAppData: (newData: Partial<AppData>) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [appData, setAppData] = useState<AppData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedData) {
        setAppData(JSON.parse(storedData));
      } else {
        // If no data in local storage, initialize with sample data
        setAppData(initialData);
      }
    } catch (error) {
      console.error('Failed to read from localStorage', error);
      setAppData(initialData);
    }
    setIsLoading(false);
  }, []);

  const updateAppData = (newData: Partial<AppData>) => {
    setAppData(prevData => {
      const updatedData = { ...prevData, ...newData } as AppData;
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedData));
      } catch (error) {
        console.error('Failed to write to localStorage', error);
      }
      return updatedData;
    });
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <AppContext.Provider value={{ appData, updateAppData }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
};
