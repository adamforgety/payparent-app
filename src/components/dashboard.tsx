

'use client';

import { addMonths, format, subMonths, getYear, getMonth, isAfter, parse, isEqual, isSameMonth, setYear, setMonth as setDateFnsMonth } from 'date-fns';
import { useMemo, useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Plus, CalendarDays, BarChart as BarChartIcon, ChevronDown, LayoutDashboard, Settings, ReceiptText as ExpensesIcon, FileText as ReportingIcon } from 'lucide-react';

import { AddExpenseDialog } from '@/components/add-expense-dialog';
import { PageHeader } from '@/components/page-header';
import type { AppData, ChildSupport, Expense, MonthData, ParentNames, CustomSplit } from '@/lib/types';
import { Logo } from './logo';
import { useToast } from '@/hooks/use-toast';
import { Button } from './ui/button';
import { DashboardSkeleton } from './dashboard-skeleton';
import { ReportingPage } from './reporting-page';
import { DashboardProvider } from './dashboard-provider';
import { useAppContext } from '@/context/app-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { GettingStartedPage } from './getting-started-page';
import { ExportButton } from './export-button';
import { DashboardTab } from './dashboard-tabs/dashboard-tab';
import { ExpensesTab } from './dashboard-tabs/expenses-tab';
import { SettingsTab } from './dashboard-tabs/settings-tab';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';
import { ImportExpensesDialog } from './import-expenses-dialog';
import { AddExpenseChooser } from './add-expense-chooser';
import { useFirebase } from '@/firebase';
import { CustomSplitCard } from './custom-split-card';
import { initialData } from '@/lib/data';

interface DashboardProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    onShowGettingStarted: () => void;
}

function DashboardUI({ appData, initialDate, activeTab, setActiveTab, onShowGettingStarted }: { appData: AppData, initialDate: Date } & DashboardProps) {
  const { updateAppData, addExpense, addImportedExpenses, deleteExpense, updateExpense: contextUpdateExpense, batchUpdateMonths, dataOwnerId } = useAppContext();
  const { user } = useFirebase();

  const [currentDate, setCurrentDate] = useState(initialDate);
  const [isAllMonthsView, setIsAllMonthsView] = useState(true);
  
  // Determine default sub-tab based on user's role
  const isDataOwner = user?.uid === dataOwnerId;
  const [dashboardSubTab, setDashboardSubTab] = useState(isDataOwner ? 'parent-1' : 'parent-2');

  const [expensesSubTab, setExpensesSubTab] = useState('monthly');
  const [settingsSubTab, setSettingsSubTab] = useState('app');
  const { toast } = useToast();
  const [isDateDropdownOpen, setDateDropdownOpen] = useState(false);
  const yearRef = useRef<HTMLDivElement>(null);
  const monthRef = useRef<HTMLDivElement>(null);
  
  const monthId = format(currentDate, 'yyyy-MM');

  useEffect(() => {
    if (appData && !appData.months[monthId]) {
      const monthKeys = Object.keys(appData.months).sort((a, b) => b.localeCompare(a));
      const mostRecentMonthId = monthKeys[0];
      const mostRecentMonthData = appData.months[mostRecentMonthId] || initialData.months[Object.keys(initialData.months)[0]];

      if (!mostRecentMonthData) return;
      
      const newMonthData: MonthData = {
        id: monthId,
        year: getYear(currentDate),
        month: getMonth(currentDate) + 1,
        childSupport: {
            ...(mostRecentMonthData.childSupport ?? initialData.months[Object.keys(initialData.months)[0]].childSupport),
            status: 'Unsettled' 
        },
        parentNames: mostRecentMonthData.parentNames,
        expenses: [],
        customSplits: mostRecentMonthData.customSplits,
      };
      
      updateAppData({ months: { ...appData.months, [monthId]: newMonthData } });
    }
  }, [appData, monthId, currentDate, updateAppData]);
  
  useEffect(() => {
    if (isDateDropdownOpen) {
      setTimeout(() => {
        yearRef.current?.scrollIntoView({ block: 'center' });
        monthRef.current?.scrollIntoView({ block: 'center' });
      }, 100);
    }
  }, [isDateDropdownOpen]);

  const { currentMonthData, availableYears, availableMonthsForYear } = useMemo(() => {
    if (!appData) {
      return { currentMonthData: null, availableYears: [String(getYear(new Date()))], availableMonthsForYear: [] };
    }
    const currentData = appData.months?.[monthId] ?? null;

    const allMonthKeys = Object.keys(appData.months).sort();
    const allYears = Array.from(new Set(allMonthKeys.map(key => key.substring(0, 4))))
      .filter(year => parseInt(year, 10) >= 2000)
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

  const handleSetYear = (year: string) => {
    setCurrentDate(setYear(currentDate, parseInt(year)));
  }

  const handleSetMonth = (monthIndex: string) => {
    setCurrentDate(setDateFnsMonth(currentDate, parseInt(monthIndex)));
  }
  
  const updateSettingsForCurrentAndFutureMonths = (dataToUpdate: Partial<Omit<MonthData, 'id'|'year'|'month'>>) => {
      if (!appData || !currentMonthData) return;

      const updatedMonths = { ...appData.months };
      const currentMonthDate = parse(monthId, 'yyyy-MM', new Date());
      
      for (const key in updatedMonths) {
          const monthDate = parse(key, 'yyyy-MM', new Date());
          if (isAfter(monthDate, currentMonthDate) || isEqual(monthDate, currentMonthDate)) {
              updatedMonths[key] = {
                  ...updatedMonths[key],
                  ...dataToUpdate,
                  ...(dataToUpdate.childSupport && { childSupport: { ...updatedMonths[key].childSupport, ...dataToUpdate.childSupport } }),
                  ...(dataToUpdate.parentNames && { parentNames: { ...updatedMonths[key].parentNames, ...dataToUpdate.parentNames } }),
                  ...(dataToUpdate.customSplits && { customSplits: dataToUpdate.customSplits }),
              };
          }
      }
      
      updateAppData({ months: updatedMonths });
  }

  const handleTabChange = (value: string) => {
    const currentMonthIndex = getMonth(currentDate) + 1;
    const currentMonthlyPayer = currentMonthData?.childSupport.monthlyPayer?.[currentMonthIndex] ?? 'None';
    
    if (activeTab === 'settings' && currentMonthData?.childSupport.amount > 0 && currentMonthlyPayer === 'None') {
      toast({
        variant: 'destructive',
        title: 'Incomplete Information',
        description: 'Please select who paid for child support before switching tabs.',
      });
      return;
    }
    if (value === 'dashboard') {
        const isDataOwner = user?.uid === dataOwnerId;
        setDashboardSubTab(isDataOwner ? 'parent-1' : 'parent-2');
    }
    setActiveTab(value);
  };

  const handleGoToUnsettled = (monthIdToGo: string) => {
    const year = parseInt(monthIdToGo.substring(0, 4));
    const month = parseInt(monthIdToGo.substring(5, 7)) - 1;
    setCurrentDate(setDateFnsMonth(setYear(new Date(), year), month));
    setActiveTab('expenses');
    setExpensesSubTab('unsettled');
    setIsAllMonthsView(false); // Switch to monthly view for the specific month
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

  const handleGoHome = () => {
    const isDataOwner = user?.uid === dataOwnerId;
    setDashboardSubTab(isDataOwner ? 'parent-1' : 'parent-2');
    setActiveTab('dashboard');
    setCurrentDate(new Date());
  };

  if (!appData || !currentMonthData) {
    return (
       <div className="container mx-auto p-4 md:p-8">
            <PageHeader
              totalExpenses={0}
              onShowGettingStarted={onShowGettingStarted}
              onGoToUnsettled={handleGoToUnsettled}
              onGoHome={handleGoHome}
            />
            <DashboardSkeleton />
       </div>
    );
  }

  const expenses = currentMonthData.expenses || [];
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard':
        return (
          <DashboardTab
            dashboardSubTab={dashboardSubTab}
            setDashboardSubTab={setDashboardSubTab}
            currentMonthData={currentMonthData}
            expenses={expenses}
            appData={appData}
            monthId={monthId}
            handleGoToUnsettled={handleGoToUnsettled}
          />
        );
      case 'expenses':
        return (
          <ExpensesTab
            expensesSubTab={expensesSubTab}
            setExpensesSubTab={setExpensesSubTab}
            expenses={expenses}
            currentMonthData={currentMonthData}
            monthId={monthId}
            handleDeleteExpense={handleDeleteExpense}
            handleUpdateExpense={handleUpdateExpense}
            updateChildSupportForSingleMonth={updateChildSupportForSingleMonth}
            currentDate={currentDate}
            appData={appData}
            isAllMonthsView={isAllMonthsView}
            setIsAllMonthsView={setIsAllMonthsView}
          />
        );
      case 'reporting':
        return (
          <div className="mt-6">
            <ReportingPage 
              appData={appData} 
              currentDate={currentDate}
              isAllMonthsView={isAllMonthsView}
              setIsAllMonthsView={setIsAllMonthsView}
            />
          </div>
        );
      case 'settings':
        return (
          <SettingsTab
            settingsSubTab={settingsSubTab}
            setSettingsSubTab={setSettingsSubTab}
            currentMonthData={currentMonthData}
            updateSettingsForCurrentAndFutureMonths={updateSettingsForCurrentAndFutureMonths}
            currentDate={currentDate}
          />
        );
      default:
        return null;
    }
  }

  return (
    <DashboardProvider
      onUpdateExpense={handleUpdateExpense}
      onUpdateChildSupport={updateChildSupportForSingleMonth}
    >
      <div className="flex flex-col">
        <PageHeader
          totalExpenses={totalExpenses}
          onShowGettingStarted={onShowGettingStarted}
          onGoToUnsettled={handleGoToUnsettled}
          onGoHome={handleGoHome}
        />
        <main className="container mx-auto p-4 pb-24 md:p-8 md:pb-20">
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

          <div className="flex items-center justify-center gap-2 mb-8 no-print">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDateChange('prev')}
              className="h-10 w-10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <DropdownMenu onOpenChange={setDateDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-xl font-semibold text-primary h-10 px-4 w-52 justify-center">
                  {format(currentDate, 'MMMM yyyy')}
                  <ChevronDown className="ml-2 h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <DropdownMenuLabel>Year</DropdownMenuLabel>
                    <ScrollArea className="h-48">
                      <DropdownMenuGroup>
                        {availableYears.map(year => {
                          const isSelected = getYear(currentDate) === parseInt(year);
                          return (
                            <DropdownMenuItem
                              key={year}
                              ref={isSelected ? yearRef : null}
                              onSelect={() => handleSetYear(year)}
                              className={isSelected ? 'font-bold bg-secondary' : ''}
                            >
                              {year}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuGroup>
                    </ScrollArea>
                  </div>
                  <div>
                    <DropdownMenuLabel>Month</DropdownMenuLabel>
                    <ScrollArea className="h-48">
                      <DropdownMenuGroup>
                        {availableMonthsForYear.map(month => {
                           const isSelected = getMonth(currentDate) === parseInt(month.value);
                          return (
                            <DropdownMenuItem
                              key={month.value}
                              ref={isSelected ? monthRef : null}
                              onSelect={() => handleSetMonth(month.value)}
                              className={isSelected ? 'font-bold bg-secondary' : ''}
                            >
                              {month.label}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuGroup>
                    </ScrollArea>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentDate(new Date())}
                    disabled={isSameMonth(currentDate, new Date())}
                    className="h-10 w-10"
                  >
                    <CalendarDays className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Go to Current Month</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDateChange('next')}
              className="h-10 w-10"
            >
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
          
          {renderContent()}

        </main>
        <nav className="bottom-nav no-print">
            <div className="bottom-nav-grid">
                <button className={cn('bottom-nav-item', activeTab === 'dashboard' && 'active')} onClick={() => handleTabChange('dashboard')}>
                    <LayoutDashboard className="h-5 w-5"/>
                    <span>Dashboard</span>
                </button>
                <button className={cn('bottom-nav-item', activeTab === 'expenses' && 'active')} onClick={() => handleTabChange('expenses')}>
                    <ExpensesIcon className="h-5 w-5"/>
                    <span>Expenses</span>
                </button>
                <div className="flex justify-center">
                    <AddExpenseChooser
                        parentNames={currentMonthData.parentNames}
                        currentDate={currentDate}
                        appData={appData}
                    />
                </div>
                <button className={cn('bottom-nav-item', activeTab === 'reporting' && 'active')} onClick={() => handleTabChange('reporting')}>
                    <ReportingIcon className="h-5 w-5"/>
                    <span>Reporting</span>
                </button>
                <button className={cn('bottom-nav-item', activeTab === 'settings' && 'active')} onClick={() => handleTabChange('settings')}>
                    <Settings className="h-5 w-5"/>
                    <span>Settings</span>
                </button>
            </div>
        </nav>
      </div>
    </DashboardProvider>
  );
}

export function Dashboard({ activeTab, setActiveTab, onShowGettingStarted }: DashboardProps) {
  const { appData, isLoading } = useAppContext();

  if (isLoading || !appData) {
     return (
       <div className="container mx-auto p-4 md:p-8">
            <PageHeader totalExpenses={0} onShowGettingStarted={onShowGettingStarted} onGoToUnsettled={() => {}} onGoHome={() => {}}/>
            <DashboardSkeleton />
       </div>
    );
  }

  return <DashboardUI appData={appData} initialDate={new Date()} activeTab={activeTab} setActiveTab={setActiveTab} onShowGettingStarted={onShowGettingStarted} />;
}
