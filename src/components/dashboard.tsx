'use client';

import { addMonths, format, subMonths, getYear, getMonth, isAfter, parse, isEqual, isSameMonth, setYear, setMonth as setDateFnsMonth } from 'date-fns';
import { useMemo, useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Plus, CalendarDays, BarChart as BarChartIcon } from 'lucide-react';

import { AddExpenseDialog } from '@/components/add-expense-dialog';
import { ChildSupportCard } from '@/components/child-support-card';
import { ExpensesCard } from '@/components/expenses-card';
import { ParentSplitCard } from '@/components/parent-split-card';
import { PageHeader } from '@/components/page-header';
import { SettleBalanceCard } from '@/components/settle-balance-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AppData, ChildSupport, Expense, MonthData, ParentNames, ExpenseSplit, MedicalExpenseSplit } from '@/lib/types';
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
import { AllUnsettledExpensesCard } from './all-unsettled-expenses-card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { SummaryDetailsCard } from './summary-details-card';
import { CoParentLinkCard } from './co-parent-link-card';
import { GettingStartedPage } from './getting-started-page';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ExportButton } from './export-button';

function DashboardComponent() {
  const { appData, updateAppData, isLoading, addExpense, addImportedExpenses, deleteExpense, updateExpense: contextUpdateExpense, isNewUser, batchUpdateMonths } = useAppContext();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [expensesSubTab, setExpensesSubTab] = useState('monthly');
  const [unsettledYearFilter, setUnsettledYearFilter] = useState<string | null>(null);
  const [unsettledMonthFilter, setUnsettledMonthFilter] = useState<string | null>(null);
  const [showGettingStarted, setShowGettingStarted] = useState(isNewUser);
  const { toast } = useToast();

  const monthId = format(currentDate, 'yyyy-MM');
  
  useEffect(() => {
    if (appData && !appData.months[monthId] && !isLoading) {
      const monthKeys = Object.keys(appData.months).sort();
      const mostRecentMonthId = monthKeys[monthKeys.length - 1];
      const mostRecentMonthData = appData.months[mostRecentMonthId] || appData.months[Object.keys(appData.months)[0]];

      if (!mostRecentMonthData) return;
      
      const newMonthDate = parse(monthId, 'yyyy-MM', new Date());

      // When creating a new month, carry over the amount, but reset paidBy and status.
      const childSupportSettings: ChildSupport = {
        amount: mostRecentMonthData.childSupport.amount,
        paidBy: 'None', 
        status: 'Unsettled' 
      };

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

  useEffect(() => {
    // Sync the unsettled filters with the main date scroller
    setUnsettledYearFilter(String(getYear(currentDate)));
    setUnsettledMonthFilter(format(currentDate, 'yyyy-MM'));
  }, [currentDate]);


  const { currentMonthData, availableYears, availableMonthsForYear } = useMemo(() => {
    if (!appData) {
      return { currentMonthData: null, availableYears: [String(getYear(new Date()))], availableMonthsForYear: [] };
    }
    const currentData = appData.months?.[monthId] ?? null;

    const allMonthKeys = Object.keys(appData.months).sort();
    const allYears = Array.from(new Set(allMonthKeys.map(key => key.substring(0, 4))))
      .filter(year => parseInt(year, 10) >= 2000) // Filter out invalid years
      .sort((a,b) => parseInt(b) - parseInt(a));
    const currentYear = String(getYear(currentDate));
    if (!allYears.includes(currentYear)) {
      allYears.push(currentYear);
      allYears.sort((a,b) => parseInt(b) - parseInt(a));
    }


    const monthsForYear = Array.from({ length: 12 }, (_, i) => {
      const monthDate = setDateFnsMonth(setYear(new Date(), parseInt(currentYear)), i);
      return {
        value: String(i),
        label: format(monthDate, 'MMMM'),
      };
    });

    return {
      currentMonthData: currentData,
      availableYears: allYears,
      availableMonthsForYear: monthsForYear
    };
  }, [appData, monthId, currentDate]);


  const handleDateChange = (direction: 'next' | 'prev') => {
    setCurrentDate((prevDate) =>
      direction === 'next' ? addMonths(prevDate, 1) : subMonths(prevDate, 1)
    );
  };
  
  const updateSettingsForCurrentAndFutureMonths = (dataToUpdate: Partial<Omit<MonthData, 'id'|'year'|'month'>>) => {
      if (!appData || !currentMonthData) return;

      const updatedMonths = { ...appData.months };
      const currentMonthDate = parse(monthId, 'yyyy-MM', new Date());
      
      // Iterate over all months and update the current one and all future ones
      for (const key in updatedMonths) {
          const monthDate = parse(key, 'yyyy-MM', new Date());
          if (isAfter(monthDate, currentMonthDate) || isEqual(monthDate, currentMonthDate)) {
              updatedMonths[key] = {
                  ...updatedMonths[key],
                  ...dataToUpdate,
                  // Ensure specific nested objects are merged correctly if they exist in dataToUpdate
                  ...(dataToUpdate.childSupport && { childSupport: { ...updatedMonths[key].childSupport, ...dataToUpdate.childSupport } }),
                  ...(dataToUpdate.expenseSplit && { expenseSplit: { ...updatedMonths[key].expenseSplit, ...dataToUpdate.expenseSplit } }),
                  ...(dataToUpdate.medicalExpenseSplit && { medicalExpenseSplit: { ...updatedMonths[key].medicalExpenseSplit, ...dataToUpdate.medicalExpenseSplit } }),
                  ...(dataToUpdate.parentNames && { parentNames: { ...updatedMonths[key].parentNames, ...dataToUpdate.parentNames } }),
              };
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
    // When user navigates away from unsettled tab, sync filters back to current date
    if (value !== 'expenses' || (value === 'expenses' && expensesSubTab !== 'unsettled')) {
      setUnsettledYearFilter(String(getYear(currentDate)));
      setUnsettledMonthFilter(format(currentDate, 'yyyy-MM'));
    }
    setActiveTab(value);
  };

  const handleGoToUnsettled = (monthIdToGo: string) => {
    const year = monthIdToGo.substring(0, 4);
    setActiveTab('expenses');
    setExpensesSubTab('unsettled');
    setUnsettledYearFilter(year);
    setUnsettledMonthFilter(monthIdToGo);
  };

  const handleDeleteExpense = (expenseId: string, expenseMonthId: string) => {
    deleteExpense(expenseId, expenseMonthId);
  };
  
  const handleUpdateExpense = (updatedExpense: Expense, originalMonthId: string) => {
    contextUpdateExpense(updatedExpense, originalMonthId);
  };

  const updateChildSupportForSingleMonth = (updatedChildSupport: ChildSupport, csMonthId: string) => {
    if (!appData) return;
    const monthData = appData.months[csMonthId];
    if (monthData) {
        const updatedMonthData = { ...monthData, childSupport: updatedChildSupport };
        updateAppData({ months: { ...appData.months, [csMonthId]: updatedMonthData } });
    }
  };
  
  if (showGettingStarted) {
    return <GettingStartedPage onFinish={() => setShowGettingStarted(false)} />;
  }

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
      onUpdateChildSupport={updateChildSupportForSingleMonth}
    >
      <div className="flex flex-col">
        <PageHeader
          totalExpenses={totalExpenses}
          onShowGettingStarted={() => setShowGettingStarted(true)}
        />
        <main className="container mx-auto p-4 md:p-8 pb-24 md:pb-8">
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

          <div className="flex flex-col items-center justify-center gap-4 mb-4 no-print">
            <div className="flex items-center gap-2 h-10">
              <Select
                value={String(getYear(currentDate))}
                onValueChange={(year) => setCurrentDate(setYear(currentDate, parseInt(year)))}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(getMonth(currentDate))}
                onValueChange={(month) => setCurrentDate(setDateFnsMonth(currentDate, parseInt(month)))}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableMonthsForYear.map(month => (
                    <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentDate(new Date())}
                      disabled={isSameMonth(currentDate, new Date())}
                    >
                      <CalendarDays className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Go to Current Month</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="w-full text-center text-xl font-semibold text-primary">
                {format(currentDate, 'MMMM yyyy')}
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-4 no-print h-auto bg-transparent p-0">
              <TabsTrigger value="dashboard" className="text-lg rounded-t-md rounded-b-none data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Dashboard</TabsTrigger>
              <TabsTrigger value="expenses" className="text-lg rounded-t-md rounded-b-none data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Expenses</TabsTrigger>
              <TabsTrigger value="reporting" className="text-lg rounded-t-md rounded-b-none data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Reporting</TabsTrigger>
              <TabsTrigger value="settings" className="text-lg rounded-t-md rounded-b-none data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="dashboard">
              <div className="mt-6">
                <Tabs defaultValue="parent-1" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger
                      value="parent-1"
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      {currentMonthData.parentNames['Parent 1']}
                    </TabsTrigger>
                    <TabsTrigger
                      value="parent-2"
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      {currentMonthData.parentNames['Parent 2']}
                    </TabsTrigger>
                  </TabsList>
                   <TabsContent value="parent-1" className="mt-6">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
                      <div className="lg:col-span-1">
                        <SettleBalanceCard
                            parent="Parent 1"
                            expenses={expenses}
                            expenseSplit={currentMonthData.expenseSplit}
                            medicalExpenseSplit={currentMonthData.medicalExpenseSplit}
                            childSupport={currentMonthData.childSupport}
                            parentNames={currentMonthData.parentNames}
                            appData={appData}
                            currentMonthId={monthId}
                            onGoToExpenses={() => handleGoToUnsettled(monthId)}
                        />
                      </div>
                      <div className="lg:col-span-2">
                        <SummaryDetailsCard
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
                    </div>
                  </TabsContent>
                  <TabsContent value="parent-2" className="mt-6">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
                      <div className="lg:col-span-1">
                        <SettleBalanceCard
                            parent="Parent 2"
                            expenses={expenses}
                            expenseSplit={currentMonthData.expenseSplit}
                            medicalExpenseSplit={currentMonthData.medicalExpenseSplit}
                            childSupport={currentMonthData.childSupport}
                            parentNames={currentMonthData.parentNames}
                            appData={appData}
                            currentMonthId={monthId}
                            onGoToExpenses={() => handleGoToUnsettled(monthId)}
                        />
                      </div>
                      <div className="lg:col-span-2">
                        <SummaryDetailsCard
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
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </TabsContent>
            <TabsContent value="expenses">
               <div className="mt-6">
                 <Tabs value={expensesSubTab} onValueChange={setExpensesSubTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="monthly" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Monthly Ledger</TabsTrigger>
                      <TabsTrigger value="unsettled" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">All Unsettled</TabsTrigger>
                    </TabsList>
                    <TabsContent value="monthly" className="mt-6">
                      <ExpensesCard
                        expenses={expenses}
                        childSupport={currentMonthData.childSupport}
                        expenseSplit={currentMonthData.expenseSplit}
                        medicalExpenseSplit={currentMonthData.medicalExpenseSplit}
                        onDelete={(expenseId) => handleDeleteExpense(expenseId, monthId)}
                        onUpdateExpense={handleUpdateExpense}
                        onUpdateChildSupport={(cs) => updateChildSupportForSingleMonth(cs, monthId)}
                        currentDate={currentDate}
                        parentNames={currentMonthData.parentNames}
                        appData={appData}
                      >
                         <AddExpenseDialog onAddExpense={addExpense} parentNames={currentMonthData.parentNames} currentDate={currentDate}>
                            <Button>
                              <Plus className="mr-2 h-4 w-4" />
                              Add Expense
                            </Button>
                          </AddExpenseDialog>
                          <ImportExpensesDialog
                            onImport={addImportedExpenses}
                            parentNames={currentMonthData.parentNames}
                            appData={appData}
                          />
                          <ExportButton
                              expenses={expenses}
                              childSupport={currentMonthData.childSupport}
                              currentDate={currentDate}
                              parentNames={currentMonthData.parentNames}
                              expenseSplit={currentMonthData.expenseSplit}
                              medicalExpenseSplit={currentMonthData.medicalExpenseSplit}
                          />
                      </ExpensesCard>
                    </TabsContent>
                    <TabsContent value="unsettled" className="mt-6">
                        <AllUnsettledExpensesCard 
                            appData={appData}
                            onUpdateExpense={handleUpdateExpense}
                            onUpdateChildSupport={updateChildSupportForSingleMonth}
                            onDeleteExpense={handleDeleteExpense}
                            currentDate={currentDate}
                            initialYearFilter={unsettledYearFilter}
                            initialMonthFilter={unsettledMonthFilter}
                        />
                    </TabsContent>
                 </Tabs>
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
                    <TabsTrigger value="app" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">App Settings</TabsTrigger>
                    <TabsTrigger value="account" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Account Settings</TabsTrigger>
                  </TabsList>
                  <TabsContent value="app">
                    <div className="grid grid-cols-1 gap-6 lg:gap-8 mt-6">
                      <ParentNamesCard
                          parentNames={currentMonthData.parentNames}
                          onUpdate={(parentNames: ParentNames) => updateSettingsForCurrentAndFutureMonths({ parentNames })}
                      />
                      <ChildSupportCard
                        childSupport={currentMonthData.childSupport}
                        onUpdate={(cs: ChildSupport) => updateSettingsForCurrentAndFutureMonths({ childSupport: cs })}
                        parentNames={currentMonthData.parentNames}
                      />
                      <ParentSplitCard
                        expenseSplit={currentMonthData.expenseSplit}
                        onUpdate={(expenseSplit: ExpenseSplit) => updateSettingsForCurrentAndFutureMonths({ expenseSplit })}
                        parentNames={currentMonthData.parentNames}
                      />
                      <MedicalSplitCard
                        expenseSplit={currentMonthData.medicalExpenseSplit}
                        onUpdate={(medicalExpenseSplit: MedicalExpenseSplit) => updateSettingsForCurrentAndFutureMonths({ medicalExpenseSplit })}
                        parentNames={currentMonthData.parentNames}
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="account">
                     <div className="grid grid-cols-1 gap-6 lg:gap-8 mt-6">
                        <CoParentLinkCard />
                        <AccountSettingsCard />
                     </div>
                  </TabsContent>
                </Tabs>
              </div>
            </TabsContent>
          </Tabs>
          <div className="fixed bottom-4 right-4 z-50 no-print">
            <TooltipProvider>
                <Tooltip>
                <TooltipTrigger asChild>
                      <AddExpenseDialog onAddExpense={addExpense} parentNames={currentMonthData.parentNames} currentDate={currentDate}>
                        <Button size="icon" className="w-14 h-14 rounded-full shadow-lg">
                            <Plus className="w-6 w-6" />
                        </Button>
                      </AddExpenseDialog>
                </TooltipTrigger>
                <TooltipContent side="left" sideOffset={15}>
                    <p>Add New Expense</p>
                </TooltipContent>
                </Tooltip>
            </TooltipProvider>
          </div>
        </main>
      </div>
    </DashboardProvider>
  );
}

export function Dashboard() {
  const { isLoading, isNewUser } = useAppContext();

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
