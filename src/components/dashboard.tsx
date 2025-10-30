'use client';

import { addMonths, format, subMonths, getYear, getMonth, startOfMonth } from 'date-fns';
import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { collection, doc, query, where, getDocs, writeBatch } from 'firebase/firestore';

import { AddExpenseDialog } from '@/components/add-expense-dialog';
import { ChildSupportCard } from '@/components/child-support-card';
import { ExpensesCard } from '@/components/expenses-card';
import { ParentSplitCard } from '@/components/parent-split-card';
import { PageHeader } from '@/components/page-header';
import { SummaryCard } from '@/components/summary-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AppData, ChildSupport, Expense, MonthData, ParentNames } from '@/lib/types';
import { Logo } from './logo';
import { useToast } from '@/hooks/use-toast';
import { ParentNamesCard } from './parent-names-card';
import { Button } from './ui/button';
import { useUser, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { setDocumentNonBlocking, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Skeleton } from './ui/skeleton';

const defaultMonthData: Omit<MonthData, 'id' | 'year' | 'month'> = {
  childSupport: { amount: 0, paidBy: 'None', status: 'Unpaid' },
  expenseSplit: { 'Parent 1': 50, 'Parent 2': 50 },
  parentNames: { 'Parent 1': 'Parent 1', 'Parent 2': 'Parent 2' },
};

export function Dashboard() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('dashboard');
  const { toast } = useToast();

  const currentYear = getYear(currentDate);
  const currentMonth = getMonth(currentDate) + 1; // date-fns months are 0-indexed

  // --- Data Fetching ---
  const settingsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'settings'),
      where('year', '==', currentYear),
      where('month', '==', currentMonth)
    );
  }, [firestore, user, currentYear, currentMonth]);

  const { data: settingsData, isLoading: isLoadingSettings } = useCollection<Omit<MonthData, 'id'>>(settingsQuery);
  const monthSettings = settingsData?.[0]; // Expecting one settings doc per month

  const expensesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'expenses'),
      where('year', '==', currentYear),
      where('month', '==', currentMonth)
    );
  }, [firestore, user, currentYear, currentMonth]);

  const { data: expenses, isLoading: isLoadingExpenses } = useCollection<Omit<Expense, 'id'>>(expensesQuery);

  const isLoading = isLoadingSettings || isLoadingExpenses;

  const handleDateChange = (direction: 'next' | 'prev') => {
    setCurrentDate((prevDate) =>
      direction === 'next' ? addMonths(prevDate, 1) : subMonths(prevDate, 1)
    );
  };
  
  const currentMonthData: MonthData = useMemo(() => {
    if (!monthSettings) {
      return {
        id: '',
        year: currentYear,
        month: currentMonth,
        ...defaultMonthData,
      };
    }
    return { ...monthSettings, id: monthSettings.id, year: monthSettings.year, month: monthSettings.month };
  }, [monthSettings, currentYear, currentMonth]);

  const getOrCreateSettingsDoc = async () => {
    if (monthSettings?.id) {
      return doc(firestore, 'users', user!.uid, 'settings', monthSettings.id);
    }
    
    // If settings don't exist for this month, create them from the previous month or default
    const lastMonth = subMonths(currentDate, 1);
    const lastYear = getYear(lastMonth);
    const lastMonthNum = getMonth(lastMonth) + 1;

    const prevSettingsQuery = query(
      collection(firestore, 'users', user!.uid, 'settings'),
      where('year', '==', lastYear),
      where('month', '==', lastMonthNum)
    );
    
    const prevSettingsSnap = await getDocs(prevSettingsQuery);
    const prevSettings = prevSettingsSnap.docs[0]?.data();
    
    const newSettingsData: Omit<MonthData, 'id'> = {
      year: currentYear,
      month: currentMonth,
      childSupport: prevSettings?.childSupport ? { ...prevSettings.childSupport, status: 'Unpaid' } : defaultMonthData.childSupport,
      expenseSplit: prevSettings?.expenseSplit || defaultMonthData.expenseSplit,
      parentNames: prevSettings?.parentNames || defaultMonthData.parentNames,
    };
    
    const newDocRef = await addDocumentNonBlocking(collection(firestore, 'users', user!.uid, 'settings'), newSettingsData);
    return newDocRef;
  };
  
  const updateMonthData = async (updatedData: Partial<Omit<MonthData, 'id' | 'year' | 'month'>>) => {
    if (!user) return;
    const settingsDocRef = await getOrCreateSettingsDoc();
    if(settingsDocRef) {
        updateDocumentNonBlocking(settingsDocRef, updatedData);
    }
  };

  const handleTabChange = (value: string) => {
    if (activeTab === 'settings' && currentMonthData.childSupport.amount > 0 && currentMonthData.childSupport.paidBy === 'None') {
      toast({
        variant: 'destructive',
        title: 'Incomplete Information',
        description: 'Please select who paid for child support before switching tabs.',
      });
      return;
    }
    setActiveTab(value);
  };


  const addExpense = async (newExpense: Omit<Expense, 'id'>) => {
    if (!user) return;
    
    const expenseWithMonth = {
        ...newExpense,
        year: currentYear,
        month: currentMonth,
    };

    addDocumentNonBlocking(collection(firestore, 'users', user.uid, 'expenses'), expenseWithMonth);
  };

  const deleteExpense = (expenseId: string) => {
    if (!user) return;
    deleteDocumentNonBlocking(doc(firestore, 'users', user.uid, 'expenses', expenseId));
  };
  
  const updateExpense = (updatedExpense: Expense) => {
     if (!user) return;
    const { id, ...dataToUpdate } = updatedExpense;
    updateDocumentNonBlocking(doc(firestore, 'users', user.uid, 'expenses', id), dataToUpdate);
  };

  const updateChildSupport = (updatedChildSupport: ChildSupport) => {
    updateMonthData({ childSupport: updatedChildSupport });
  }

  const handleMarkAllAsPaid = async () => {
    if (!user || !expenses) return;

    const batch = writeBatch(firestore);

    // Mark expenses as paid
    const unpaidExpenses = expenses.filter(exp => exp.status === 'Unpaid');
    unpaidExpenses.forEach(exp => {
      const expRef = doc(firestore, 'users', user.uid, 'expenses', exp.id);
      batch.update(expRef, { status: 'Paid' });
    });

    // Mark child support as paid
    if (currentMonthData.childSupport.status === 'Unpaid' && monthSettings?.id) {
        const settingsRef = doc(firestore, 'users', user.uid, 'settings', monthSettings.id);
        batch.update(settingsRef, { 'childSupport.status': 'Paid' });
    }
    
    await batch.commit();

    toast({
      title: 'All Items Marked as Paid',
      description: 'All unpaid expenses and child support for this month are now paid.',
    });
  };

  const totalExpenses = expenses?.reduce(
    (sum, exp) => sum + exp.amount,
    0
  ) || 0;
  
  if (isLoading) {
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
          </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-3 no-print h-auto bg-transparent p-0">
            <TabsTrigger value="dashboard" className="text-lg rounded-t-md rounded-b-none data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Dashboard</TabsTrigger>
            <TabsTrigger value="expenses" className="text-lg rounded-t-md rounded-b-none data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Expenses</TabsTrigger>
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
                      expenses={expenses || []}
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
                      expenses={expenses || []}
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
                  expenses={expenses || []}
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
          <TabsContent value="settings">
            <div className="grid grid-cols-1 gap-6 lg:gap-8 mt-6">
               <ParentNamesCard
                  parentNames={currentMonthData.parentNames}
                  onUpdate={(parentNames) => updateMonthData({ parentNames })}
               />
               <ChildSupportCard
                childSupport={currentMonthData.childSupport}
                onUpdate={updateChildSupport}
                parentNames={currentMonthData.parentNames}
              />
              <ParentSplitCard
                expenseSplit={currentMonthData.expenseSplit}
                onUpdate={(expenseSplit) => updateMonthData({ expenseSplit })}
                parentNames={currentMonthData.parentNames}
              />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
