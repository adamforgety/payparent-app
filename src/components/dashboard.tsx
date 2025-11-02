'use client';

import { addMonths, format, subMonths, getYear, getMonth, isAfter, parse } from 'date-fns';
import { useMemo, useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

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
import { Skeleton } from './ui/skeleton';
import { ReportingPage } from './reporting-page';
import { DashboardProvider } from './dashboard-provider';
import { MedicalSplitCard } from './medical-split-card';
import { useAppContext } from '@/context/app-context';
import { ImportExpensesDialog } from './import-expenses-dialog';
import { AccountSettingsCard } from './account-settings-card';

function DashboardComponent() {
  const { appData, updateAppData, isLoading, addExpense, addImportedExpenses, deleteExpense, updateExpense: contextUpdateExpense } = useAppContext();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('dashboard');
  const { toast } = useToast();

  const monthId = format(currentDate, 'yyyy-MM');
  
  useEffect(() => {
    if (appData && !appData.months[monthId] && !isLoading) {
      const monthKeys = Object.keys(appData.months).sort();
      const mostRecentMonthId = monthKeys[monthKeys.length - 1];
      const mostRecentMonthData = appData.months[mostRecentMonthId] || appData.months[Object.keys(appData.months)[0]];

      if (!mostRecentMonthData) return;
      
      const newMonthDate = parse(monthId, 'yyyy-MM', new Date());
      const mostRecentMonthDate = parse(mostRecentMonthId, 'yyyy-MM', new Date());

      // Only copy child support if the new month is AFTER the most recent month
      const childSupportSettings = isAfter(newMonthDate, mostRecentMonthDate) 
        ? { ...(mostRecentMonthData.childSupport || { amount: 0, paidBy: 'None', ignored: false }), status: 'Unsettled' }
        : { amount: 0, paidBy: 'None', status: 'Unsettled', ignored: false };


      const newMonthData: MonthData = {
        id: monthId,
        year: getYear(currentDate),
        month: getMonth(currentDate) + 1,
        childSupport: childSupportSettings,
        expenseSplit: mostRecentMonthData.expenseSplit || { 'Parent 1': 50, 'Parent 2': 50 },
        medicalExpenseSplit: mostRecentMonthData.medicalExpenseSplit || { 'Parent 1': 48, 'Parent 2': 52 },
        parentNames: mostRecentMonthData.parentNames || { 'Parent 1': 'Parent 1', 'Parent 2': 'Parent 2' },
        expenses: [],
      };
      
      updateAppData({ months: { ...appData.months, [monthId]: newMonthData } });
    }
  }, [appData, monthId, currentDate, updateAppData, isLoading]);


  const currentMonthData = useMemo((): MonthData | null => {
    return appData?.months?.[monthId] ?? null;
  }, [appData, monthId]);


  const handleDateChange = (direction: 'next' | 'prev') => {
    setCurrentDate((prevDate) =>
      direction === 'next' ? addMonths(prevDate, 1) : subMonths(prevDate, 1)
    );
  };
  
  const updateCurrentMonthData = (dataToUpdate: Partial<Omit<MonthData, 'id'|'year'|'month'>>) => {
      if (!appData || !currentMonthData) return;

      const updatedMonths = { ...appData.months };
      
      // Update the current month
      updatedMonths[monthId] = {
        ...currentMonthData,
        ...dataToUpdate,
      };

      // If child support settings changed, propagate to future months
      if (dataToUpdate.childSupport) {
        const currentMonthDate = parse(monthId, 'yyyy-MM', new Date());
        for (const key in updatedMonths) {
            const monthDate = parse(key, 'yyyy-MM', new Date());
            if (isAfter(monthDate, currentMonthDate)) {
                updatedMonths[key] = {
                    ...updatedMonths[key],
                    childSupport: {
                      ...updatedMonths[key].childSupport, // keep existing status
                      ...dataToUpdate.childSupport,
                    }
                };
            }
        }
      }
      
      updateAppData({ months: updatedMonths });
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

  const handleDeleteExpense = (expenseId: string) => {
    deleteExpense(expenseId, monthId);
  };
  
  const handleUpdateExpense = (updatedExpense: Expense) => {
    contextUpdateExpense(updatedExpense, monthId);
  };

  const updateChildSupport = (updatedChildSupport: ChildSupport) => {
    updateCurrentMonthData({ childSupport: updatedChildSupport });
  };
  
  const handleUpdateParentNames = (parentNames: ParentNames) => {
    // This now triggers the global update in the context
    updateAppData({ parentNames });
  };

  const handleMarkAllAsSettled = () => {
    if (!currentMonthData) return;

    let madeChanges = false;
    const updatedExpenses = currentMonthData.expenses.map(exp => {
      if (exp.status === 'Unsettled') {
        madeChanges = true;
        return { ...exp, status: 'Settled' };
      }
      return exp;
    });
    
    let updatedChildSupport = currentMonthData.childSupport;
    if (currentMonthData.childSupport.status === 'Unsettled' && currentMonthData.childSupport.amount > 0) {
      updatedChildSupport = { ...currentMonthData.childSupport, status: 'Settled' };
      madeChanges = true;
    }
    
    if (madeChanges) {
      updateCurrentMonthData({ expenses: updatedExpenses, childSupport: updatedChildSupport });
      toast({
        title: 'All Items Marked as Settled',
        description: 'All unsettled expenses and child support for this month are now settled.',
      });
    }
  };

  const handleMarkAllAsUnsettled = () => {
    if (!currentMonthData) return;

    let madeChanges = false;
    const updatedExpenses = currentMonthData.expenses.map(exp => {
      if (exp.status === 'Settled') {
        madeChanges = true;
        return { ...exp, status: 'Unsettled' };
      }
      return exp;
    });

    let updatedChildSupport = currentMonthData.childSupport;
    if (currentMonthData.childSupport.status === 'Settled' && currentMonthData.childSupport.amount > 0) {
      updatedChildSupport = { ...currentMonthData.childSupport, status: 'Unsettled' };
      madeChanges = true;
    }

    if (madeChanges) {
      updateCurrentMonthData({ expenses: updatedExpenses, childSupport: updatedChildSupport });
      toast({
        title: 'All Items Marked as Unsettled',
        description: 'All settled expenses and child support for this month have been reverted to unsettled.',
      });
    }
  };
  
  if (isLoading || !appData || !currentMonthData) {
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
      onUpdateExpense={handleUpdateExpense}
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
                <div className="mb-6 flex justify-end">
                    <AddExpenseDialog onAddExpense={addExpense} parentNames={currentMonthData.parentNames} />
                </div>
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
                        appData={appData}
                        currentMonthId={monthId}
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
                        appData={appData}
                        currentMonthId={monthId}
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
                    medicalExpenseSplit={currentMonthData.medicalExpenseSplit}
                    onDelete={handleDeleteExpense}
                    onUpdateExpense={handleUpdateExpense}
                    onUpdateChildSupport={updateChildSupport}
                    onMarkAllAsSettled={handleMarkAllAsSettled}
                    onMarkAllAsUnsettled={handleMarkAllAsUnsettled}
                    currentDate={currentDate}
                    parentNames={currentMonthData.parentNames}
                  >
                    <AddExpenseDialog onAddExpense={addExpense} parentNames={currentMonthData.parentNames} />
                    <ImportExpensesDialog onImport={addImportedExpenses} parentNames={currentMonthData.parentNames} />
                  </ExpensesCard>
                </div>
            </TabsContent>
            <TabsContent value="reporting">
              <div className="mt-6">
                  <ReportingPage appData={appData} />
                </div>
            </TabsContent>
            <TabsContent value="settings">
              <div className="mt-6">
                <Tabs defaultValue="app" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="app">App Settings</TabsTrigger>
                    <TabsTrigger value="account">Account Settings</TabsTrigger>
                  </TabsList>
                  <TabsContent value="app">
                    <div className="grid grid-cols-1 gap-6 lg:gap-8 mt-6">
                      <ParentNamesCard
                          parentNames={appData.months[Object.keys(appData.months)[0]].parentNames}
                          onUpdate={handleUpdateParentNames}
                      />
                      <ChildSupportCard
                        childSupport={currentMonthData.childSupport}
                        onUpdate={updateChildSupport}
                        parentNames={currentMonthData.parentNames}
                      />
                      <ParentSplitCard
                        expenseSplit={currentMonthData.expenseSplit}
                        onUpdate={(expenseSplit) => updateCurrentMonthData({ expenseSplit })}
                        parentNames={currentMonthData.parentNames}
                      />
                      <MedicalSplitCard
                        expenseSplit={currentMonthData.medicalExpenseSplit}
                        onUpdate={(medicalExpenseSplit) => updateCurrentMonthData({ medicalExpenseSplit })}
                        parentNames={currentMonthData.parentNames}
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="account">
                     <div className="grid grid-cols-1 gap-6 lg:gap-8 mt-6">
                        <AccountSettingsCard />
                     </div>
                  </TabsContent>
                </Tabs>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </DashboardProvider>
  );
}

export function Dashboard() {
  const { isLoading } = useAppContext();

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

  return <DashboardComponent />;
}

    