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
import { doc, onSnapshot, getDoc } from 'firebase/firestore';

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
  const { firestore, user } = useFirebase();

  const [appData, setAppData] = useState<AppData | null>(null);
  const [coParentData, setCoParentData] = useState<UserDoc | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Effect to load initial data and set up listeners
  useEffect(() => {
    if (!user || !firestore) {
      setIsLoading(false);
      setAppData(null);
      setCoParentData(null);
      return;
    }

    setIsLoading(true);

    // Initial fetch of user data
    getUserData(firestore, user.uid)
      .then((data) => {
        setAppData(data);
      })
      .catch((error) => {
        console.error('Failed to load user data:', error);
        setAppData(null);
      })
      .finally(() => {
        setIsLoading(false);
      });

    // --- Set up real-time listeners ---
    
    // 1. Listener for the current user's document (for coParentId changes)
    const userDocRef = doc(firestore, 'users', user.uid);
    const userUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
      const userDoc = docSnap.data() as UserDoc;
      // If coParentId changes, refetch all data.
      // This is a simple way to handle linking/unlinking.
      if (userDoc?.coParentId !== (coParentData?.id || null)) {
         getUserData(firestore, user.uid).then(setAppData);
      }

      // If a co-parent is linked, also fetch their user data to display their email.
      if (userDoc?.coParentId) {
        const coParentDocRef = doc(firestore, 'users', userDoc.coParentId);
        getDoc(coParentDocRef).then(coParentSnap => {
          if (coParentSnap.exists()) {
            setCoParentData(coParentSnap.data() as UserDoc);
          } else {
             setCoParentData(null);
          }
        });
      } else {
        setCoParentData(null);
      }
    });

    // 2. Listener for the actual app data (which might be the co-parent's data)
    let dataUnsubscribe: () => void = () => {};
    const setDataListener = async () => {
        const currentUserDoc = (await getDoc(userDocRef)).data() as UserDoc | undefined;
        const targetId = currentUserDoc?.coParentId || user.uid;
        const dataDocRef = doc(firestore, 'users', targetId);

        dataUnsubscribe = onSnapshot(dataDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const docData = docSnap.data() as UserDoc;
                setAppData(docData.appData);
            }
        });
    }
    
    setDataListener();


    return () => {
      userUnsubscribe();
      dataUnsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, firestore]);

  const updateAppData = useCallback(
    (newData: Partial<Omit<AppData, 'id' | 'email'>>) => {
      if (!user || !firestore || !appData) return;

      const newMonths = { ...appData.months, ...newData.months };
      const updatedData = { ...appData, ...newData, months: newMonths };
      
      // The saveUserData function already contains the logic to save to the correct (co-parent's) document
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
