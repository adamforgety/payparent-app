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
import type { AppData, Expense, ParentNames } from '@/lib/types';
import { useFirebase } from '@/firebase';
import { getUserData, saveUserData } from '@/lib/data-service';
import { Loader2 } from 'lucide-react';
import { format, getMonth, getYear } from 'date-fns';

interface AppContextType {
  appData: AppData | null;
  updateAppData: (newData: Partial<AppData>) => void;
  isLoading: boolean;
  addExpense: (newExpense: Omit<Expense, 'id' | 'year' | 'month'>) => void;
  addImportedExpenses: (
    importedExpenses: Omit<Expense, 'id' | 'year' | 'month'>[]
  ) => void;
  deleteExpense: (expenseId: string, monthId: string) => void;
  updateExpense: (updatedExpense: Expense, originalMonthId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppContextProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { firestore, user } = useFirebase();

  const [appData, setAppData] = useState<AppData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Effect to load data when user and firestore are available
  useEffect(() => {
    if (user && firestore) {
      setIsLoading(true);
      getUserData(firestore, user.uid)
        .then((data) => {
          setAppData(data);
        })
        .catch((error) => {
          console.error('Failed to load user data:', error);
          setAppData(null); // Or some error state
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else if (!user) {
      // If there's no user, we are not loading data.
      setIsLoading(false);
      setAppData(null);
    }
  }, [user, firestore]);

  const updateAppData = useCallback(
    async (newData: Partial<AppData>) => {
      if (!user || !firestore) return;

      // Use a function for state updates to get the most recent state
      setAppData((prevAppData) => {
        if (!prevAppData) return null;

        let updatedData: AppData;

        // Special handling for parentNames to update all months
        if (newData.parentNames) {
          const newParentNames = newData.parentNames;
          const updatedMonths = { ...prevAppData.months };
          for (const monthId in updatedMonths) {
            updatedMonths[monthId] = {
              ...updatedMonths[monthId],
              parentNames: newParentNames,
            };
          }
          updatedData = { ...prevAppData, ...newData, months: updatedMonths };
        } else {
          // Standard merge for other properties
          updatedData = {
            ...prevAppData,
            ...newData,
            months: {
              ...prevAppData.months,
              ...newData.months,
            },
          };
        }

        // Asynchronously save to Firestore
        saveUserData(firestore, user.uid, updatedData).catch((error) => {
          console.error('Failed to save data:', error);
          // Optionally revert state or show an error
        });

        return updatedData;
      });
    },
    [user, firestore]
  );

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

    // If the target month doesn't exist, create it by copying from the most recent month
    if (!targetMonthData) {
      const monthKeys = Object.keys(appData.months).sort();
      const mostRecentMonthId = monthKeys[monthKeys.length - 1];
      const mostRecentMonthData = appData.months[mostRecentMonthId];

      targetMonthData = {
        id: targetMonthId,
        year: getYear(expenseDate),
        month: getMonth(expenseDate) + 1,
        childSupport: mostRecentMonthData?.childSupport
          ? { ...mostRecentMonthData.childSupport, status: 'Unsettled' }
          : { amount: 0, paidBy: 'None', status: 'Unsettled' },
        expenseSplit: mostRecentMonthData?.expenseSplit || {
          'Parent 1': 50,
          'Parent 2': 50,
        },
        medicalExpenseSplit: mostRecentMonthData?.medicalExpenseSplit || {
          'Parent 1': 48,
          'Parent 2': 52,
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

        targetMonthData = {
          id: targetMonthId,
          year: getYear(expenseDate),
          month: getMonth(expenseDate) + 1,
          childSupport: mostRecentMonthData?.childSupport
            ? { ...mostRecentMonthData.childSupport, status: 'Unsettled' }
            : { amount: 0, paidBy: 'None', status: 'Unsettled' },
          expenseSplit: mostRecentMonthData?.expenseSplit || {
            'Parent 1': 50,
            'Parent 2': 50,
          },
          medicalExpenseSplit: mostRecentMonthData?.medicalExpenseSplit || {
            'Parent 1': 48,
            'Parent 2': 52,
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

    // If month has changed, move the expense
    if (originalMonthId !== newMonthId) {
      // 1. Remove from original month
      if (newMonths[originalMonthId]) {
        newMonths[originalMonthId] = {
          ...newMonths[originalMonthId],
          expenses: newMonths[originalMonthId].expenses.filter(
            (exp) => exp.id !== updatedExpense.id
          ),
        };
      }

      // 2. Add to new month (or create new month if it doesn't exist)
      let targetMonthData = newMonths[newMonthId];
      if (!targetMonthData) {
        // Create new month by copying from a recent month to preserve settings
        const monthKeys = Object.keys(appData.months).sort();
        const mostRecentMonthId = monthKeys[monthKeys.length - 1];
        const mostRecentMonthData = appData.months[mostRecentMonthId];
        targetMonthData = {
          id: newMonthId,
          year: getYear(newDate),
          month: getMonth(newDate) + 1,
          childSupport: mostRecentMonthData?.childSupport
            ? { ...mostRecentMonthData.childSupport, status: 'Unsettled' }
            : { amount: 0, paidBy: 'None', status: 'Unsettled' },
          expenseSplit:
            mostRecentMonthData?.expenseSplit || { 'Parent 1': 50, 'Parent 2': 50 },
          medicalExpenseSplit: mostRecentMonthData?.medicalExpenseSplit || {
            'Parent 1': 48,
            'Parent 2': 52,
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
      // If month is the same, just update the expense in place
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
    }),
    [appData, updateAppData, isLoading, addExpense, addImportedExpenses, deleteExpense, updateExpense]
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
