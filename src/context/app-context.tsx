
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
import type { AppData, ChildSupport, Expense, UserDoc, MonthData, Notification } from '@/lib/types';
import { useFirebase } from '@/firebase';
import { saveUserData } from '@/lib/data-service';
import { Loader2, Users } from 'lucide-react';
import { format, getMonth, getYear, parse, isAfter } from 'date-fns';
import { doc, onSnapshot, getDoc, FirestoreError, collection, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
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

// Helper function to manage notifications
const manageNotification = async (
    firestore: any,
    expense: Expense,
    coParentId: string | null,
    ownerName: string | null
) => {
    if (!coParentId || !ownerName) return;

    if (expense.category === 'Reimbursement' || expense.category === 'Credit') {
        const recipientId = expense.paidBy === 'Parent 1' ? 'Parent 2' : 'Parent 1';
        const otherParentId = expense.paidBy === 'Parent 1' ? coParentId : ownerName;

        const notifRef = collection(firestore, 'users', otherParentId, 'notifications');
        const newNotification: Omit<Notification, 'id' | 'createdAt'> = {
            recipientId: otherParentId,
            expenseId: expense.id,
            message: `${ownerName} requested a reimbursement for "${expense.description}".`,
            type: 'reimbursement_request',
        };

        try {
            await addDoc(notifRef, {
                ...newNotification,
                createdAt: serverTimestamp(),
            });
        } catch (error) {
             errorEmitter.emit(
                'permission-error',
                new FirestorePermissionError({
                    path: `users/${otherParentId}/notifications`,
                    operation: 'create',
                    requestResourceData: newNotification,
                })
            );
        }
    }
};

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

  // Effect to listen to the current user's document to determine their data owner and co-parent.
  useEffect(() => {
    if (isUserLoading || !firestore || !user) {
      // If the user is not authenticated or firebase is not ready, reset state.
      if (!isUserLoading && !user) {
        setIsLoading(false);
        setAppData(null);
        setCurrentUserDoc(null);
        setDataOwnerId(null);
        setCoParentData(null);
      }
      return;
    }
    
    setIsLoading(true);
    const currentUserDocRef = doc(firestore, 'users', user.uid);

    const unsubscribeUser = onSnapshot(currentUserDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const userDocData = docSnap.data() as UserDoc;
            setCurrentUserDoc(userDocData);
            setDataOwnerId(userDocData.dataOwnerId || user.uid);
            // Listen for co-parent data if coParentId exists
            if (userDocData.coParentId && firestore) {
              const coParentDocRef = doc(firestore, 'users', userDocData.coParentId);
              getDoc(coParentDocRef).then(coParentSnap => {
                if(coParentSnap.exists()){
                  setCoParentData(coParentSnap.data() as UserDoc);
                }
              });
            } else {
              setCoParentData(null);
            }
            setIsNewUser(false);
        } else {
            // This is a new user who doesn't have a document yet.
            setIsNewUser(true);
            setAppData(null);
            setDataOwnerId(null);
            setCoParentData(null);
            setIsLoading(false); // New user flow doesn't require further data loading
        }
    }, (error) => {
        console.error("Error listening to current user doc:", error);
        errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'get', path: currentUserDocRef.path }));
        setIsLoading(false);
    });

    return () => unsubscribeUser();
  }, [user, firestore, isUserLoading]);

  // Effect to listen to the actual appData from the data owner's document.
  useEffect(() => {
      if (!firestore || !dataOwnerId) {
        if (!isNewUser) {
          setIsLoading(true); // Still loading if we expect a data owner but don't have the ID yet
        }
        return;
      }

      const dataOwnerDocRef = doc(firestore, 'users', dataOwnerId);
      const unsubscribeAppData = onSnapshot(dataOwnerDocRef, (docSnap) => {
          if (docSnap.exists()) {
              const ownerDoc = docSnap.data() as UserDoc;
              setAppData(ownerDoc.appData || JSON.parse(JSON.stringify(initialData)));
          } else {
              setAppData(null);
          }
          setIsLoading(false); // Data is loaded or confirmed not to exist
      }, (error) => {
          console.error("Error listening to app data:", error);
          errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'get', path: dataOwnerDocRef.path }));
          setAppData(null);
          setIsLoading(false);
      });

      return () => unsubscribeAppData();
  }, [firestore, dataOwnerId, isNewUser]);


  const updateAppData = useCallback(
    (newData: Partial<Omit<AppData, 'id' | 'email'>>) => {
      if (!user || !firestore || !appData || !dataOwnerId) return;

      const newMonths = { ...appData.months, ...newData.months };
      const updatedData = { ...appData, ...newData, months: newMonths };
      
      // Data is always saved to the data owner's document
      saveUserData(firestore, dataOwnerId, updatedData).catch(console.error);
    },
    [user, firestore, appData, dataOwnerId]
  );
   
  const batchUpdateMonths = useCallback(
    (monthUpdates: { [monthId: string]: Partial<MonthData> }) => {
        if (!user || !firestore || !appData || !dataOwnerId) return;

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
        
        saveUserData(firestore, dataOwnerId, updatedData).catch(console.error);
    },
    [user, firestore, appData, dataOwnerId]
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
    
    if (firestore) {
      manageNotification(firestore, newExpenseWithId, coParentData?.id ?? null, user?.displayName ?? user?.email ?? 'A user');
    }
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
      
      if (firestore) {
        manageNotification(firestore, newExpenseWithId, coParentData?.id ?? null, user?.displayName ?? user?.email ?? 'A user');
      }
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
    if (firestore) {
      manageNotification(firestore, updatedExpense, coParentData?.id ?? null, user?.displayName ?? user?.email ?? 'A user');
    }
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
    [appData, updateAppData, batchUpdateMonths, isLoading, coParentData, isNewUser, deleteExpense, updateExpense]
  );

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
