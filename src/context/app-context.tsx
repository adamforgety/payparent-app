'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import type { AppData } from '@/lib/types';
import { useFirebase } from '@/firebase';
import { getUserData, saveUserData } from '@/lib/data-service';
import { Loader2 } from 'lucide-react';

interface AppContextType {
  appData: AppData | null;
  updateAppData: (newData: Partial<AppData>) => void;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { firestore, user } = useFirebase();
  
  const [appData, setAppData] = useState<AppData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Effect to load data when user and firestore are available
  useEffect(() => {
    if (user && firestore) {
      setIsLoading(true);
      getUserData(firestore, user.uid)
        .then(data => {
          setAppData(data);
        })
        .catch(error => {
          console.error("Failed to load user data:", error);
          setAppData(null); // Or some error state
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else if (!user) {
        // If there's no user, we are not loading data.
        setIsLoading(false);
    }
  }, [user, firestore]);
  

  const updateAppData = useCallback(async (newData: Partial<AppData>) => {
    if (!appData || !user || !firestore) return;
    
    let updatedData: AppData;

    // Special handling for parentNames to update all months
    if (newData.parentNames) {
      const newParentNames = newData.parentNames;
      const updatedMonths = { ...appData.months };
      for (const monthId in updatedMonths) {
        updatedMonths[monthId] = {
          ...updatedMonths[monthId],
          parentNames: newParentNames
        };
      }
      updatedData = { ...appData, ...newData, months: updatedMonths };
    } else {
      // Standard merge for other properties
      updatedData = { 
          ...appData, 
          ...newData,
          months: {
              ...appData.months,
              ...newData.months,
          }
      };
    }
    
    // Set local state immediately for snappy UI
    setAppData(updatedData);

    // Asynchronously save to Firestore and wait for it to complete
    try {
      await saveUserData(firestore, user.uid, updatedData);
    } catch (error) {
      console.error("Failed to save data:", error);
      // Optionally, you could revert the state or show an error to the user here
    }
  }, [appData, user, firestore]);
  
  const contextValue = useMemo(() => ({
    appData,
    updateAppData,
    isLoading
  }), [appData, updateAppData, isLoading]);

  if (isLoading) {
    return (
       <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Loader2 className="mr-2 h-8 w-8 animate-spin" />
        <p className="text-muted-foreground">Loading your financial data...</p>
      </div>
    );
  }

  return (
    <AppContext.Provider value={contextValue}>
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
