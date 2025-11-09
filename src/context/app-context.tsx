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
import type { AppData, ChildSupport, Expense, UserDoc, MonthData } from '@/lib/types';
import { useFirebase } from '@/firebase';
import { saveUserData } from '@/lib/data-service';
import { Loader2 } from 'lucide-react';
import { format, getMonth, getYear, parse, isAfter } from 'date-fns';
import { doc, onSnapshot, getDoc, FirestoreError } from 'firebase/firestore';
import { errorEmitter, FirestorePermissionError } from '@/firebase';
import { initialData } from '@/lib/data';

interface AppContextType {
  appData: AppData | null;
  updateAppData: (newData: Partial<Omit<AppData, 'id' | 'email'>>) => void;
  batchUpdateMonths: (monthUpdates: { [monthId: string]: Partial<MonthData> }) => void;
  isLoading: boolean;
  addExpense: (newExpense: Omit<Expense, 'id' | 'year' | 'month'>) => void;
  addImportedExpenses: (
    importedExpenses: Omit<Expense, 'id' | 'year' | 'month'>[]
  ) => { [monthId: string]: number };
  deleteExpense: (expenseId: string, monthId: string) => void;
  updateExpense: (updatedExpense: Expense, originalMonthId: string) => void;
  updateChildSupport: (updatedChildSupport: ChildSupport, monthId: string) => void;
  coParentData: UserDoc | null;
  isNewUser: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppContextProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { firestore, user, isUserLoading } = useFirebase();

  const [appData, setAppData] = useState<AppData | null>(null);
  const [coParentData, setCoParentData] = useState<UserDoc | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  
  // This effect runs once when the user's auth state is confirmed.
  // It is responsible for setting up all data listeners.
  useEffect(() => {
    if (isUserLoading || !firestore || !user) {
      setIsLoading(true);
      return;
    }

    let appDataUnsubscribe: (() => void) | undefined;

    const setupData = async () => {
      setIsLoading(true);
      try {
        const currentUserDocRef = doc(firestore, 'users', user.uid);
        const userDocSnap = await getDoc(currentUserDocRef);

        if (!userDocSnap.exists()) {
          setIsNewUser(true);
          setAppData(null);
          setCoParentData(null);
          setIsLoading(false);
          return;
        }

        setIsNewUser(false);
        const userDocData = userDocSnap.data() as UserDoc;
        const dataOwnerId = userDocData.dataOwnerId || user.uid;
        const coParentId = userDocData.coParentId;

        // Fetch co-parent's static data (like email) if they exist
        if (coParentId) {
          const coParentDocRef = doc(firestore, 'users', coParentId);
          const coParentDocSnap = await getDoc(coParentDocRef);
          if (coParentDocSnap.exists()) {
            setCoParentData(coParentDocSnap.data() as UserDoc);
          } else {
             setCoParentData(null);
          }
        } else {
          setCoParentData(null);
        }

        // Set up the single, authoritative listener for the shared appData
        const dataOwnerDocRef = doc(firestore, 'users', dataOwnerId);
        appDataUnsubscribe = onSnapshot(dataOwnerDocRef, (dataDocSnap) => {
            if (dataDocSnap.exists()) {
                const ownerDoc = dataDocSnap.data() as UserDoc;
                setAppData(ownerDoc.appData || JSON.parse(JSON.stringify(initialData)));
            } else {
                setAppData(null);
            }
            if (isLoading) setIsLoading(false);
        }, (error: FirestoreError) => {
            const contextualError = new FirestorePermissionError({ operation: 'get', path: dataOwnerDocRef.path });
            errorEmitter.emit('permission-error', contextualError);
            setAppData(null);
            setIsLoading(false);
        });

      } catch (error) {
        console.error("Error setting up data:", error);
        const contextualError = new FirestorePermissionError({ operation: 'get', path: `/users/${user.uid}` });
        errorEmitter.emit('permission-error', contextualError);
        setIsLoading(false);
      }
    };

    setupData();

    // Cleanup function for the useEffect hook
    return () => {
      if (appDataUnsubscribe) {
        appDataUnsubscribe();
      }
    };
  // The dependency array ensures this effect runs only when the user's state changes.
  }, [user, firestore, isUserLoading]);


  const updateAppData = useCallback(
    (newData: Partial<Omit<AppData, 'id' | 'email'>>) => {
      if (!user || !firestore || !appData) return;

      const newMonths = { ...appData.months, ...newData.months };
      const updatedData = { ...appData, ...newData, months: newMonths };
      
      // The saveUserData function already correctly identifies the dataOwnerId
      saveUserData(firestore, user.uid, updatedData).catch(console.error);
    },
    [user, firestore, appData]
  );
   
  const batchUpdateMonths = useCallback(
    (monthUpdates: { [monthId: string]: Partial<MonthData> }) => {
        if (!user || !firestore || !appData) return;

        const newMonths = { ...appData.months };
        for (const monthId in monthUpdates) {
            if (newMonths[monthId]) {
                newMonths[monthId] = {
                    ...newMonths[monthId],
                    ...monthUpdates[monthId],
                };
            }
        }
        const updatedData = { ...appData, months: newMonths };
        
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
    if (!appData?.months) return {};

    const newMonths = { ...appData.months };
    const monthSummary: { [monthId: string]: number } = {};

    importedExpenses.forEach((newExpense) => {
      const expenseDate = new Date(newExpense.date);
      const targetMonthId = format(expenseDate, 'yyyy-MM');
      
      monthSummary[targetMonthId] = (monthSummary[targetMonthId] || 0) + 1;

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
    return monthSummary;
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
      batchUpdateMonths,
      isLoading,
      addExpense,
      addImportedExpenses,
      deleteExpense,
      updateExpense,
      updateChildSupport,
      coParentData,
      isNewUser,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appData, updateAppData, batchUpdateMonths, isLoading, coParentData, isNewUser]
  );

  if (isLoading) { // Show full-screen loader on initial load and setup
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
