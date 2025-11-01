'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import type { AppData, UserDoc } from '@/lib/types';
import { initialData } from '@/lib/data';
import { useFirebase, useDoc, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';

const LOCAL_STORAGE_KEY = 'payparent_app_data';

interface AppContextType {
  appData: AppData | null;
  updateAppData: (newData: Partial<AppData>) => void;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { firestore, user } = useFirebase();
  
  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userDoc, isLoading: isUserDocLoading } = useDoc<UserDoc>(userDocRef);
  
  const [appData, setAppData] = useState<AppData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(isUserDocLoading);

    if (!isUserDocLoading) {
      if (userDoc) {
        // Data from Firestore exists
        setAppData(userDoc.appData);
      } else if (user && userDocRef) {
        // No Firestore data, use initial and save it
        const initial = { ...initialData, id: user.uid };
        setAppData(initial);
        setDocumentNonBlocking(userDocRef, { id: user.uid, appData: initial }, { merge: true });
      }
    }

  }, [user, userDoc, isUserDocLoading, userDocRef]);
  

  const updateAppData = useCallback((newData: Partial<AppData>) => {
    setAppData(prevData => {
      if (!prevData || !userDocRef) return prevData;
      
      const updatedData = { ...prevData, ...newData } as AppData;

      // Use the correct non-blocking update function
      setDocumentNonBlocking(userDocRef, { appData: updatedData }, { merge: true });
      
      return updatedData;
    });
  }, [userDocRef]);
  
  const contextValue = useMemo(() => ({
    appData,
    updateAppData,
    isLoading
  }), [appData, updateAppData, isLoading]);

  if (isLoading) {
    return (
       <div className="flex min-h-screen flex-col items-center justify-center gap-4">
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
