'use client';

import { addMonths, format, subMonths, getYear, getMonth } from 'date-fns';
import { useMemo, useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { doc } from 'firebase/firestore';

import { AddExpenseDialog } from '@/components/add-expense-dialog';
import { ChildSupportCard } from '@/components/child-support-card';
import { ExpensesCard } from '@/components/expenses-card';
import { ParentSplitCard } from '@/components/parent-split-card';
import { PageHeader } from '@/components/page-header';
import { SummaryCard } from '@/components/summary-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AppData, ChildSupport, Expense, MonthData } from '@/lib/types';
import { Logo } from './logo';
import { useToast } from '@/hooks/use-toast';
import { ParentNamesCard } from './parent-names-card';
import { Button } from './ui/button';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Skeleton } from './ui/skeleton';
import { ReportingPage } from './reporting-page';

const defaultMonthData: Omit<MonthData, 'id' | 'year' | 'month'> = {
  childSupport: { amount: 0, paidBy: 'None', status: 'Unpaid' },
  expenseSplit: { 'Parent 1': 50, 'Parent 2': 50 },
  expenses: [],
  parentNames: { 'Parent 1': 'Parent 1', 'Parent 2': 'Parent 2' },
};


export function Dashboard() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('dashboard');
  const { toast } = useToast();

  const monthId = format(currentDate, 'yyyy-MM');

  // --- Data Fetching ---
  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: appData, isLoading: isLoadingUser } = useDoc<AppData>(userDocRef);
  
  // Effect to initialize data for new users or new months
  useEffect(() => {
    // This effect should only run AFTER the initial user loading is complete.
    if (isLoadingUser || !user || !userDocRef) {
      return;
    }
  
    // SCENARIO 1: The user document does not exist at all. This is a new user.
    if (!appData) {
      const initialMonthData: MonthData = {
        ...defaultMonthData,
        id: monthId,
        year: getYear(currentDate),
        month: getMonth(currentDate) + 1,
      };
      const initialUserData: AppData = {
        id: user.uid,
        months: { [monthId]: initialMonthData },
      };
      // Create the user document for the first time.
      setDocumentNonBlocking(userDocRef, initialUserData);
      return; // Stop here for this render cycle.
    }
  
    // SCENARIO 2: The user document EXISTS, but the data for the CURRENTLY VIEWED month is missing.
    const monthDataExists = appData.months && appData.months[monthId];
    if (appData && !monthDataExists) {
      const lastMonth = subMonths(currentDate, 1);
      const lastMonthId = format(lastMonth, 'yyyy-MM');
      // Try to get settings from the previous month to carry them over.
      const lastMonthData = appData.months?.[lastMonthId];
  
      const newMonthData: MonthData = {
        id: monthId,
        year: getYear(currentDate),
        month: getMonth(currentDate) + 1,
        // Carry over settings from previous month if they exist, otherwise use defaults
        childSupport: lastMonthData?.childSupport ? { ...lastMonthData.childSupport, status: 'Unpaid' } : defaultMonthData.childSupport,
        expenseSplit: lastMonthData?.expenseSplit || defaultMonthData.expenseSplit,
        parentNames: lastMonthData?.parentNames || defaultMonthData.parentNames,
        expenses: [], // Always start a new month with no expenses
      };
      
      // Persist only the new month's data to avoid race conditions. Use merge: true.
      setDocumentNonBlocking(userDocRef, { months: { [monthId]: newMonthData } }, { merge: true });
    }
  
  }, [appData, isLoadingUser, user, userDocRef, monthId, currentDate]);
  


  const currentMonthData = useMemo((): MonthData | null => {
    return appData?.months?.[monthId] ?? null;
  }, [appData, monthId]);


  const handleDateChange = (direction: 'next' | 'prev') => {
    setCurrentDate((prevDate) =>
      direction === 'next' ? addMonths(prevDate, 1) : subMonths(prevDate, 1)
    );
  };
  
  // This function now directly prepares data for Firestore, without intermediate state.
  const updateFirestoreMonthData = (dataToUpdate: Partial<Omit<MonthData, 'id'|'year'|'month'>>) => {
      if (!userDocRef || !currentMonthData) return;
      // Merge the updates with the existing data for the month before sending to Firestore
      const updatedMonthData = { ...currentMonthData, ...dataToUpdate };
      setDocumentNonBlocking(userDocRef, { months: { [monthId]: updatedMonthData } }, { merge: true });
  }

  const handleTabChange = (value: string) => {
    if (activeTab === 'settings' && currentMonthData?.childSupport.amount > 0 && currentMonthData?.childSupport.paidBy === 'None') {
      toast({
        variant: 'destructive',
        title: 'Incomplete Information',
        description: 'Please select who paid for child support before switching tabs.',
      });
      return;
    }
    setActiveTab(value);
  };

  const addExpense = (newExpense: Omit<Expense, 'id' | 'year' | 'month'>) => {
    if (!user || !userDocRef || !appData) return; // Guard against no user or appData
  
    const expenseDate = new Date(newExpense.date);
    const targetMonthId = format(expenseDate, 'yyyy-MM');
  
    const newExpenseWithId: Expense = {
      ...newExpense,
      id: `${Date.now()}-${Math.random()}`, // Simple unique ID
      year: getYear(expenseDate),
      month: getMonth(expenseDate) + 1,
    };
  
    // Determine the state of the target month from the most recent appData
    const targetMonthData = appData.months?.[targetMonthId] || {
        id: targetMonthId,
        year: getYear(expenseDate),
        month: getMonth(expenseDate) + 1,
        childSupport: currentMonthData?.childSupport || defaultMonthData.childSupport,
        expenseSplit: currentMonthData?.expenseSplit || defaultMonthData.expenseSplit,
        parentNames: currentMonthData?.parentNames || defaultMonthData.parentNames,
        expenses: [],
    };
    
    const updatedExpenses = [...targetMonthData.expenses, newExpenseWithId];
  
    // Persist the change to Firestore for the correct month
    setDocumentNonBlocking(userDocRef, { months: { [targetMonthId]: { ...targetMonthData, expenses: updatedExpenses } } }, { merge: true });
  };
  
  const deleteExpense = (expenseId: string) => {
    if (!userDocRef || !currentMonthData) return;
    const updatedExpenses = currentMonthData.expenses.filter(exp => exp.id !== expenseId);
    updateFirestoreMonthData({ expenses: updatedExpenses });
  };
  
  const updateExpense = (updatedExpense: Expense) => {
    if (!userDocRef || !currentMonthData) return;
    const updatedExpenses = currentMonthData.expenses.map(exp => exp.id === updatedExpense.id ? updatedExpense : exp);
    updateFirestoreMonthData({ expenses: updatedExpenses });
  };

  const updateChildSupport = (updatedChildSupport: ChildSupport) => {
    updateFirestoreMonthData({ childSupport: updatedChildSupport });
  };

  const handleMarkAllAsPaid = () => {
    if (!userDocRef || !currentMonthData) return;

    let updatedMonthData: Partial<MonthData> = {};

    const unpaidExpensesExist = currentMonthData.expenses.some(exp => exp.status === 'Unpaid');
    if (unpaidExpensesExist) {
        updatedMonthData.expenses = currentMonthData.expenses.map(exp => exp.status === 'Unpaid' ? { ...exp, status: 'Paid' } : exp);
    }
    
    if (currentMonthData.childSupport.status === 'Unpaid' && currentMonthData.childSupport.amount > 0) {
      updatedMonthData.childSupport = { ...currentMonthData.childSupport, status: 'Paid' };
    }
    
    if (Object.keys(updatedMonthData).length > 0) {
      updateFirestoreMonthData(updatedMonthData);
      toast({
        title: 'All Items Marked as Paid',
        description: 'All unpaid expenses and child support for this month are now paid.',
      });
    }
  };
  
  // While loading user data OR if the month's data hasn't been created yet, show a skeleton UI.
  // This is the critical gate that prevents rendering with incomplete/missing data.
  if (isLoadingUser || !currentMonthData) {
    return (
       <div className="container mx-auto p-4 md:p-8">
            <div className="flex flex-col items-center justify-center gap-4 mb-8">
              <Skeleton className="h-10 w-52" />
            </div>
             <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8 mt-6">
                <Skeleton className="h-96" />
                <Skeleton className="h-96" />
                <Skeleton className="h-96" />
             </div>
       </div>
    )
  }

  // At this point, currentMonthData is guaranteed to be available.
  const expenses = currentMonthData.expenses || [];
  const totalExpenses = expenses.reduce(
    (sum, exp) => sum + exp.amount,
    0
  );

  return (
    <div className="flex flex-col">
      <PageHeader
        totalExpenses={totalExpenses}
      />
      <main className="container mx-auto p-4 md:p-8">
        <div className="mb-8 hidden print-only">
          <div className="print-header flex items-center justify-between">
            <Logo />
            <div>
              <h1 className="text-3xl font-bold">Monthly Report</h1>
              <p className="text-lg text-muted-foreground">
                {format(currentDate, 'MMMM yyyy')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-4 mb-8 no-print">
          {activeTab !== 'reporting' && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleDateChange('prev')}
                aria-label="Previous month"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="w-40 text-center text-lg font-semibold">
                {format(currentDate, 'MMMM yyyy')}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleDateChange('next')}
                aria-label="Next month"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-4 no-print h-auto bg-transparent p-0">
            <TabsTrigger value="dashboard" className="text-lg rounded-t-md rounded-b-none data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Dashboard</TabsTrigger>
            <TabsTrigger value="expenses" className="text-lg rounded-t-md rounded-b-none data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Expenses</TabsTrigger>
            <TabsTrigger value="reporting" className="text-lg rounded-t-md rounded-b-none data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Reporting</TabsTrigger>
            <TabsTrigger value="settings" className="text-lg rounded-t-md rounded-b-none data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard">
            <div className="mt-8">
              <Tabs defaultValue="parent-1" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="parent-1">{currentMonthData.parentNames['Parent 1']}</TabsTrigger>
                  <TabsTrigger value="parent-2">{currentMonthData.parentNames['Parent 2']}</TabsTrigger>
                </TabsList>
                <TabsContent value="parent-1">
                  <div className="mt-6">
                    <SummaryCard
                      parent="Parent 1"
                      totalExpenses={totalExpenses}
                      expenses={expenses}
                      expenseSplit={currentMonthData.expenseSplit}
                      childSupport={currentMonthData.childSupport}
                      onUpdateExpense={updateExpense}
                      onUpdateChildSupport={updateChildSupport}
                      parentNames={currentMonthData.parentNames}
                    />
                  </div>
                </TabsContent>
                <TabsContent value="parent-2">
                  <div className="mt-6">
                    <SummaryCard
                      parent="Parent 2"
                      totalExpenses={totalExpenses}
                      expenses={expenses}
                      expenseSplit={currentMonthData.expenseSplit}
                      childSupport={currentMonthData.childSupport}
                      onUpdateExpense={updateExpense}
                      onUpdateChildSupport={updateChildSupport}
                      parentNames={currentMonthData.parentNames}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>
          <TabsContent value="expenses">
             <div className="mt-6">
                <ExpensesCard
                  expenses={expenses}
                  childSupport={currentMonthData.childSupport}
                  expenseSplit={currentMonthData.expenseSplit}
                  onDelete={deleteExpense}
                  onUpdateExpense={updateExpense}
                  onMarkAllAsPaid={handleMarkAllAsPaid}
                  currentDate={currentDate}
                  parentNames={currentMonthData.parentNames}
                >
                  <AddExpenseDialog onAddExpense={addExpense} parentNames={currentMonthData.parentNames} />
                </ExpensesCard>
              </div>
          </TabsContent>
           <TabsContent value="reporting">
             <div className="mt-6">
                <ReportingPage appData={appData} />
              </div>
          </TabsContent>
          <TabsContent value="settings">
            <div className="grid grid-cols-1 gap-6 lg:gap-8 mt-6">
               <ParentNamesCard
                  parentNames={currentMonthData.parentNames}
                  onUpdate={(parentNames) => updateFirestoreMonthData({ parentNames })}
               />
               <ChildSupportCard
                childSupport={currentMonthData.childSupport}
                onUpdate={updateChildSupport}
                parentNames={currentMonthData.parentNames}
              />
              <ParentSplitCard
                expenseSplit={currentMonthData.expenseSplit}
                onUpdate={(expenseSplit) => updateFirestoreMonthData({ expenseSplit })}
                parentNames={currentMonthData.parentNames}
              />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
