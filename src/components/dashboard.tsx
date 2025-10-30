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
import { DashboardProvider } from './dashboard-provider';
import { MedicalSplitCard } from './medical-split-card';

const defaultMonthData: Omit<MonthData, 'id' | 'year' | 'month'> = {
  childSupport: { amount: 0, paidBy: 'None', status: 'Unpaid' },
  expenseSplit: { 'Parent 1': 50, 'Parent 2': 50 },
  medicalExpenseSplit: { 'Parent 1': 48, 'Parent 2': 52 },
  expenses: [],
  parentNames: { 'Parent 1': 'Parent 1', 'Parent 2': 'Parent 2' },
};

function DashboardComponent() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('dashboard');
  const { toast } = useToast();

  const monthId = format(currentDate, 'yyyy-MM');

  // --- Data Fetching ---
  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: appData, isLoading: isLoadingUserDoc } = useDoc<AppData>(userDocRef);
  
  // Effect to initialize data for new users or new months
  useEffect(() => {
    // This effect should only run AFTER the initial user loading is complete.
    if (isLoadingUserDoc || !user || !userDocRef) {
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
        medicalExpenseSplit: lastMonthData?.medicalExpenseSplit || defaultMonthData.medicalExpenseSplit,
        parentNames: lastMonthData?.parentNames || defaultMonthData.parentNames,
        expenses: [], // Always start a new month with no expenses
      };
      
      // Persist only the new month's data using merge to avoid overwriting.
      setDocumentNonBlocking(userDocRef, { months: { [monthId]: newMonthData } }, { merge: true });
    }
  
  }, [appData, isLoadingUserDoc, user, userDocRef, monthId, currentDate]);
  


  const currentMonthData = useMemo((): MonthData | null => {
    return appData?.months?.[monthId] ?? null;
  }, [appData, monthId]);


  const handleDateChange = (direction: 'next' | 'prev') => {
    setCurrentDate((prevDate) =>
      direction === 'next' ? addMonths(prevDate, 1) : subMonths(prevDate, 1)
    );
  };
  
  const updateFirestoreMonthData = (dataToUpdate: Partial<Omit<MonthData, 'id'|'year'|'month'>>) => {
      if (!userDocRef || !currentMonthData) return;
      
      const updatedMonthPayload = {
        ...currentMonthData,
        ...dataToUpdate,
      };
      
      setDocumentNonBlocking(userDocRef, { months: { [monthId]: updatedMonthPayload } }, { merge: true });
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
    if (!user || !userDocRef || !appData) return;
  
    const expenseDate = new Date(newExpense.date);
    const targetMonthId = format(expenseDate, 'yyyy-MM');
  
    const newExpenseWithId: Expense = {
      ...newExpense,
      id: `${Date.now()}-${Math.random()}`,
      year: getYear(expenseDate),
      month: getMonth(expenseDate) + 1,
    };
  
    const targetMonthData = appData.months?.[targetMonthId] || {
        id: targetMonthId,
        year: getYear(expenseDate),
        month: getMonth(expenseDate) + 1,
        childSupport: currentMonthData?.childSupport || defaultMonthData.childSupport,
        expenseSplit: currentMonthData?.expenseSplit || defaultMonthData.expenseSplit,
        medicalExpenseSplit: currentMonthData?.medicalExpenseSplit || defaultMonthData.medicalExpenseSplit,
        parentNames: currentMonthData?.parentNames || defaultMonthData.parentNames,
        expenses: [],
    };
    
    const updatedExpenses = [...targetMonthData.expenses, newExpenseWithId];
  
    setDocumentNonBlocking(userDocRef, { months: { [targetMonthId]: { ...targetMonthData, expenses: updatedExpenses } } }, { merge: true });
  };
  
  const deleteExpense = (expenseId: string) => {
    if (!currentMonthData) return;
    const updatedExpenses = currentMonthData.expenses.filter(exp => exp.id !== expenseId);
    updateFirestoreMonthData({ expenses: updatedExpenses });
  };
  
  const updateExpense = (updatedExpense: Expense) => {
    if (!currentMonthData) return;
    const updatedExpenses = currentMonthData.expenses.map(exp => exp.id === updatedExpense.id ? updatedExpense : exp);
    updateFirestoreMonthData({ expenses: updatedExpenses });
  };

  const updateChildSupport = (updatedChildSupport: ChildSupport) => {
    updateFirestoreMonthData({ childSupport: updatedChildSupport });
  };

  const handleMarkAllAsPaid = () => {
    if (!currentMonthData) return;

    let madeChanges = false;
    let updatedExpenses = currentMonthData.expenses;
    let updatedChildSupport = currentMonthData.childSupport;

    if (currentMonthData.expenses.some(exp => exp.status === 'Unpaid')) {
        updatedExpenses = currentMonthData.expenses.map(exp => exp.status === 'Unpaid' ? { ...exp, status: 'Paid' } : exp);
        madeChanges = true;
    }
    
    if (currentMonthData.childSupport.status === 'Unpaid' && currentMonthData.childSupport.amount > 0) {
      updatedChildSupport = { ...currentMonthData.childSupport, status: 'Paid' };
      madeChanges = true;
    }
    
    if (madeChanges) {
      updateFirestoreMonthData({ expenses: updatedExpenses, childSupport: updatedChildSupport });
      toast({
        title: 'All Items Marked as Paid',
        description: 'All unpaid expenses and child support for this month are now paid.',
      });
    }
  };
  
  if (isUserLoading || isLoadingUserDoc || !currentMonthData) {
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

  const expenses = currentMonthData.expenses || [];
  const totalExpenses = expenses.reduce(
    (sum, exp) => sum + exp.amount,
    0
  );

  return (
    <DashboardProvider
      onUpdateExpense={updateExpense}
      onUpdateChildSupport={updateChildSupport}
    >
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
                        expenses={expenses}
                        expenseSplit={currentMonthData.expenseSplit}
                        medicalExpenseSplit={currentMonthData.medicalExpenseSplit}
                        childSupport={currentMonthData.childSupport}
                        parentNames={currentMonthData.parentNames}
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="parent-2">
                    <div className="mt-6">
                      <SummaryCard
                        parent="Parent 2"
                        expenses={expenses}
                        expenseSplit={currentMonthData.expenseSplit}
                        medicalExpenseSplit={currentMonthData.medicalExpenseSplit}
                        childSupport={currentMonthData.childSupport}
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
                    onUpdateChildSupport={updateChildSupport}
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
                <MedicalSplitCard
                  expenseSplit={currentMonthData.medicalExpenseSplit}
                  onUpdate={(medicalExpenseSplit) => updateFirestoreMonthData({ medicalExpenseSplit })}
                  parentNames={currentMonthData.parentNames}
                />
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </DashboardProvider>
  );
}

export function Dashboard() {
  return <DashboardComponent />;
}
