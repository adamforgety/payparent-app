'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
  useCallback,
} from 'react';
import type { AppData, ChildSupport, Expense, UserDoc } from '@/lib/types';
import { useFirebase } from '@/firebase';
import { getUserData, saveUserData } from '@/lib/data-service';
import { Loader2 } from 'lucide-react';
import { format, getMonth, getYear, parse, isAfter } from 'date-fns';
import { doc, onSnapshot, getDoc, FirestoreError } from 'firebase/firestore';
import { errorEmitter, FirestorePermissionError } from '@/firebase';

interface AppContextType {
  appData: AppData | null;
  updateAppData: (newData: Partial<Omit<AppData, 'id' | 'email'>>) => void;
  isLoading: boolean;
  addExpense: (newExpense: Omit<Expense, 'id' | 'year' | 'month'>) => void;
  addImportedExpenses: (
    importedExpenses: Omit<Expense, 'id' | 'year' | 'month'>[]
  ) => void;
  deleteExpense: (expenseId: string, monthId: string) => void;
  updateExpense: (updatedExpense: Expense, originalMonthId: string) => void;
  updateChildSupport: (updatedChildSupport: ChildSupport, monthId: string) => void;
  coParentData: UserDoc | null;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppContextProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { firestore, user, isUserLoading } = useFirebase();

  const [appData, setAppData] = useState<AppData | null>(null);
  const [coParentData, setCoParentData] = useState<UserDoc | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Effect to load initial data and set up listeners
  useEffect(() => {
    // Wait until the initial auth check is complete before doing anything.
    if (isUserLoading || !firestore) {
      setIsLoading(true);
      return;
    }
    
    // If auth is checked and there's no user, we are done.
    if (!user) {
        setIsLoading(false);
        setAppData(null);
        setCoParentData(null);
        return;
    }

    setIsLoading(true);

    // --- Set up real-time listeners ---
    
    let userUnsubscribe = () => {};
    let dataUnsubscribe: () => void = () => {};

    // This async function sets up all listeners. It's called inside the effect.
    const setupListeners = async () => {
      if (!user || !firestore) return;

      const userDocRef = doc(firestore, 'users', user.uid);

      // 1. Listener for the current user's document to get coParent and dataOwner info
      userUnsubscribe = onSnapshot(userDocRef, 
        async (userDocSnap) => {
          if (!userDocSnap.exists()) {
            setIsLoading(false);
            return;
          }

          const userDocData = userDocSnap.data() as UserDoc;
          
          // Determine the target document for app data
          const dataOwnerId = userDocData.dataOwnerId || user.uid;
          const dataDocRef = doc(firestore, 'users', dataOwnerId);
          
          // Set up or update the listener for the shared appData
          if (dataUnsubscribe) dataUnsubscribe(); // Detach old listener if any
          dataUnsubscribe = onSnapshot(dataDocRef, 
            (dataDocSnap) => {
              if (dataDocSnap.exists()) {
                const dataDoc = dataDocSnap.data() as UserDoc;
                setAppData(dataDoc.appData);
              }
              setIsLoading(false);
            },
            (error: FirestoreError) => {
              const contextualError = new FirestorePermissionError({ operation: 'get', path: dataDocRef.path });
              errorEmitter.emit('permission-error', contextualError);
              setAppData(null);
              setIsLoading(false);
            }
          );
          
          // Fetch co-parent's profile info if they are linked
          if (userDocData.coParentId) {
            const coParentDocRef = doc(firestore, 'users', userDocData.coParentId);
            const coParentSnap = await getDoc(coParentDocRef);
            if (coParentSnap.exists()) {
              setCoParentData(coParentSnap.data() as UserDoc);
            } else {
              setCoParentData(null);
            }
          } else {
            setCoParentData(null);
          }
        },
        (error: FirestoreError) => {
          const contextualError = new FirestorePermissionError({ operation: 'get', path: userDocRef.path });
          errorEmitter.emit('permission-error', contextualError);
          setIsLoading(false);
        }
      );
    };

    setupListeners();

    return () => {
      userUnsubscribe();
      dataUnsubscribe();
    };
  }, [user, firestore, isUserLoading]);

  const updateAppData = useCallback(
    (newData: Partial<Omit<AppData, 'id' | 'email'>>) => {
      if (!user || !firestore || !appData) return;

      const newMonths = { ...appData.months, ...newData.months };
      const updatedData = { ...appData, ...newData, months: newMonths };
      
      saveUserData(firestore, user.uid, updatedData).catch(console.error);
    },
    [user, firestore, appData]
  );
  
  const updateChildSupport = (updatedChildSupport: ChildSupport, monthId: string) => {
    if (!appData) return;
    const monthData = appData.months[monthId];
    if (monthData) {
      const updatedMonthData = { ...monthData, childSupport: updatedChildSupport };
      updateAppData({ months: { ...appData.months, [monthId]: updatedMonthData } });
    }
  };

  const addExpense = (
    newExpense: Omit<Expense, 'id' | 'year' | 'month'>
  ) => {
    if (!appData?.months) return;

    const expenseDate = new Date(newExpense.date);
    const targetMonthId = format(expenseDate, 'yyyy-MM');

    const newExpenseWithId: Expense = {
      ...newExpense,
      id: `${Date.now()}-${Math.random()}`,
      year: getYear(expenseDate),
      month: getMonth(expenseDate) + 1,
    };

    const newMonths = { ...appData.months };
    let targetMonthData = newMonths[targetMonthId];

    if (!targetMonthData) {
      const monthKeys = Object.keys(appData.months).sort();
      const mostRecentMonthId = monthKeys[monthKeys.length - 1];
      const mostRecentMonthData = appData.months[mostRecentMonthId];

      const newMonthDate = parse(targetMonthId, 'yyyy-MM', new Date());
      const mostRecentMonthDate = parse(mostRecentMonthId, 'yyyy-MM', new Date());
      
      const childSupportSettings: ChildSupport = {
        amount: isAfter(newMonthDate, mostRecentMonthDate) ? (mostRecentMonthData?.childSupport?.amount ?? 0) : 0,
        paidBy: 'None', 
        status: 'Unsettled' 
      };

      targetMonthData = {
        id: targetMonthId,
        year: getYear(expenseDate),
        month: getMonth(expenseDate) + 1,
        childSupport: childSupportSettings,
        expenseSplit: mostRecentMonthData?.expenseSplit || {
          'Parent 1': 50,
          'Parent 2': 50,
        },
        medicalExpenseSplit: mostRecentMonthData?.medicalExpenseSplit || {
          'Parent 1': 50,
          'Parent 2': 50,
        },
        parentNames: mostRecentMonthData?.parentNames || {
          'Parent 1': 'Parent 1',
          'Parent 2': 'Parent 2',
        },
        expenses: [],
      };
    }

    const updatedExpenses = [...targetMonthData.expenses, newExpenseWithId];
    newMonths[targetMonthId] = { ...targetMonthData, expenses: updatedExpenses };
    updateAppData({ months: newMonths });
  };

  const addImportedExpenses = (
    importedExpenses: Omit<Expense, 'id' | 'year' | 'month'>[]
  ) => {
    if (!appData?.months) return;

    const newMonths = { ...appData.months };

    importedExpenses.forEach((newExpense) => {
      const expenseDate = new Date(newExpense.date);
      const targetMonthId = format(expenseDate, 'yyyy-MM');

      const newExpenseWithId: Expense = {
        ...newExpense,
        id: `${Date.now()}-${Math.random()}`,
        year: getYear(expenseDate),
        month: getMonth(expenseDate) + 1,
      };

      let targetMonthData = newMonths[targetMonthId];

      if (!targetMonthData) {
        const monthKeys = Object.keys(newMonths).sort();
        const mostRecentMonthId = monthKeys[monthKeys.length - 1];
        const mostRecentMonthData = newMonths[mostRecentMonthId];

        const newMonthDate = parse(targetMonthId, 'yyyy-MM', new Date());
        const mostRecentMonthDate = parse(mostRecentMonthId, 'yyyy-MM', new Date());

        const childSupportSettings: ChildSupport = {
            amount: isAfter(newMonthDate, mostRecentMonthDate) ? (mostRecentMonthData?.childSupport?.amount ?? 0) : 0,
            paidBy: 'None',
            status: 'Unsettled'
        };

        targetMonthData = {
          id: targetMonthId,
          year: getYear(expenseDate),
          month: getMonth(expenseDate) + 1,
          childSupport: childSupportSettings,
          expenseSplit: mostRecentMonthData?.expenseSplit || {
            'Parent 1': 50,
            'Parent 2': 50,
          },
          medicalExpenseSplit: mostRecentMonthData?.medicalExpenseSplit || {
            'Parent 1': 50,
            'Parent 2': 50,
          },
          parentNames: mostRecentMonthData?.parentNames || {
            'Parent 1': 'Parent 1',
            'Parent 2': 'Parent 2',
          },
          expenses: [],
        };
      }

      const updatedExpenses = [...targetMonthData.expenses, newExpenseWithId];
      newMonths[targetMonthId] = { ...targetMonthData, expenses: updatedExpenses };
    });

    updateAppData({ months: newMonths });
  };

  const deleteExpense = (expenseId: string, monthId: string) => {
    if (!appData?.months?.[monthId]) return;

    const updatedExpenses = appData.months[monthId].expenses.filter(
      (exp) => exp.id !== expenseId
    );
    const updatedMonthData = {
      ...appData.months[monthId],
      expenses: updatedExpenses,
    };
    updateAppData({
      months: { ...appData.months, [monthId]: updatedMonthData },
    });
  };

  const updateExpense = (updatedExpense: Expense, originalMonthId: string) => {
    if (!appData) return;

    const newDate = new Date(updatedExpense.date);
    const newMonthId = format(newDate, 'yyyy-MM');
    const newMonths = { ...appData.months };

    if (originalMonthId !== newMonthId) {
      if (newMonths[originalMonthId]) {
        newMonths[originalMonthId] = {
          ...newMonths[originalMonthId],
          expenses: newMonths[originalMonthId].expenses.filter(
            (exp) => exp.id !== updatedExpense.id
          ),
        };
      }

      let targetMonthData = newMonths[newMonthId];
      if (!targetMonthData) {
        const monthKeys = Object.keys(appData.months).sort();
        const mostRecentMonthId = monthKeys[monthKeys.length - 1];
        const mostRecentMonthData = appData.months[mostRecentMonthId];
        
        const newMonthDate = parse(newMonthId, 'yyyy-MM', new Date());
        const mostRecentMonthDate = parse(mostRecentMonthId, 'yyyy-MM', new Date());

        const childSupportSettings: ChildSupport = {
          amount: isAfter(newMonthDate, mostRecentMonthDate) ? (mostRecentMonthData?.childSupport?.amount ?? 0) : 0,
          paidBy: 'None',
          status: 'Unsettled'
        };
        
        targetMonthData = {
          id: newMonthId,
          year: getYear(newDate),
          month: getMonth(newDate) + 1,
          childSupport: childSupportSettings,
          expenseSplit:
            mostRecentMonthData?.expenseSplit || { 'Parent 1': 50, 'Parent 2': 50 },
          medicalExpenseSplit: mostRecentMonthData?.medicalExpenseSplit || {
            'Parent 1': 50,
            'Parent 2': 50,
          },
          parentNames: mostRecentMonthData?.parentNames || {
            'Parent 1': 'Parent 1',
            'Parent 2': 'Parent 2',
          },
          expenses: [],
        };
      }
      
      newMonths[newMonthId] = {
        ...targetMonthData,
        expenses: [...targetMonthData.expenses, updatedExpense],
      };
    } else {
      if (newMonths[originalMonthId]) {
        newMonths[originalMonthId] = {
          ...newMonths[originalMonthId],
          expenses: newMonths[originalMonthId].expenses.map((exp) =>
            exp.id === updatedExpense.id ? updatedExpense : exp
          ),
        };
      }
    }

    updateAppData({ months: newMonths });
  };

  const contextValue = useMemo(
    () => ({
      appData,
      updateAppData,
      isLoading,
      addExpense,
      addImportedExpenses,
      deleteExpense,
      updateExpense,
      updateChildSupport,
      coParentData,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appData, updateAppData, isLoading, coParentData]
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Loader2 className="mr-2 h-8 w-8 animate-spin" />
        <p className="text-muted-foreground">Loading your financial data...</p>
      </div>
    );
  }

  return (
    <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
  );
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
};
