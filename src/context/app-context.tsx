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

  const [currentUserDoc, setCurrentUserDoc] = useState<UserDoc | null>(null);
  const [coParentData, setCoParentData] = useState<UserDoc | null>(null);
  const [appData, setAppData] = useState<AppData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const [dataOwnerId, setDataOwnerId] = useState<string | null>(null);
  const [coParentId, setCoParentId] = useState<string | null>(null);


  // Step 1: Listen to the current user's document to get their IDs
  useEffect(() => {
    if (isUserLoading || !firestore || !user) {
      setIsLoading(true);
      return;
    }
    
    const currentUserDocRef = doc(firestore, 'users', user.uid);
    const unsubscribeUser = onSnapshot(currentUserDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const userDocData = docSnap.data() as UserDoc;
            setCurrentUserDoc(userDocData);
            setDataOwnerId(userDocData.dataOwnerId || user.uid);
            setCoParentId(userDocData.coParentId);
            setIsNewUser(false);
        } else {
            // This is a new user who doesn't have a document yet.
            setIsNewUser(true);
            setAppData(null);
            setCoParentData(null);
            setDataOwnerId(null);
            setCoParentId(null);
            setCurrentUserDoc(null);
            setIsLoading(false);
        }
    }, (error) => {
        console.error("Error listening to current user doc:", error);
        errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'get', path: currentUserDocRef.path }));
        setIsLoading(false);
    });

    return () => unsubscribeUser();
  }, [user, firestore, isUserLoading]);


  // Step 2: Listen to the co-parent's document if the ID exists
  useEffect(() => {
      if (!firestore || !coParentId) {
          setCoParentData(null);
          return;
      }
      
      const coParentDocRef = doc(firestore, 'users', coParentId);
      const unsubscribeCoParent = onSnapshot(coParentDocRef, (docSnap) => {
          if (docSnap.exists()) {
              setCoParentData(docSnap.data() as UserDoc);
          } else {
              setCoParentData(null);
          }
      }, (error) => {
          console.error("Error listening to co-parent doc:", error);
          setCoParentData(null);
      });

      return () => unsubscribeCoParent();
  }, [firestore, coParentId]);


  // Step 3: Listen to the shared appData from the data owner's document
  useEffect(() => {
      if (!firestore || !dataOwnerId) {
          setAppData(null);
          if (!isNewUser) setIsLoading(true); // Still loading if we expect a data owner
          else setIsLoading(false); // Not loading if it's a new user
          return;
      }

      setIsLoading(true);
      const dataOwnerDocRef = doc(firestore, 'users', dataOwnerId);
      const unsubscribeAppData = onSnapshot(dataOwnerDocRef, (docSnap) => {
          if (docSnap.exists()) {
              const ownerDoc = docSnap.data() as UserDoc;
              setAppData(ownerDoc.appData || JSON.parse(JSON.stringify(initialData)));
          } else {
              // This can happen during unlinking, where dataOwnerId points to a doc that is being changed
              // Or if data is inconsistent. Fallback to user's own data.
              setAppData(currentUserDoc?.appData || null);
          }
          setIsLoading(false);
      }, (error) => {
          console.error("Error listening to app data:", error);
          errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'get', path: dataOwnerDocRef.path }));
          setAppData(null);
          setIsLoading(false);
      });

      return () => unsubscribeAppData();
  }, [firestore, dataOwnerId, isNewUser, currentUserDoc]);


  const updateAppData = useCallback(
    (newData: Partial<Omit<AppData, 'id' | 'email'>>) => {
      if (!user || !firestore || !appData) return;

      const newMonths = { ...appData.months, ...newData.months };
      const updatedData = { ...appData, ...newData, months: newMonths };
      
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
    [appData, updateAppData, batchUpdateMonths, isLoading, coParentData, isNewUser]
  );

  if (isLoading && !isNewUser) { // Show full-screen loader on initial load and setup, but not for a new user
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
