'use client';

import { addMonths, format, subMonths } from 'date-fns';
import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';


import { AddExpenseDialog } from '@/components/add-expense-dialog';
import { ChildSupportCard } from '@/components/child-support-card';
import { ExpensesCard } from '@/components/expenses-card';
import { ParentSplitCard } from '@/components/parent-split-card';
import { PageHeader } from '@/components/page-header';
import { SummaryCard } from '@/components/summary-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { initialData } from '@/lib/data';
import type { AppData, ChildSupport, Expense, MonthData } from '@/lib/types';
import { Logo } from './logo';
import { useToast } from '@/hooks/use-toast';
import { ParentNamesCard } from './parent-names-card';
import { Button } from './ui/button';

const defaultMonthData: MonthData = {
  childSupport: { amount: 0, paidBy: 'None', status: 'Unpaid' },
  expenseSplit: { 'Parent 1': 50, 'Parent 2': 50 },
  expenses: [],
  parentNames: { 'Parent 1': 'Parent 1', 'Parent 2': 'Parent 2' },
};

export function Dashboard() {
  const [data, setData] = useState<AppData>(initialData);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('dashboard');
  const { toast } = useToast();


  const handleDateChange = (direction: 'next' | 'prev') => {
    setCurrentDate((prevDate) =>
      direction === 'next' ? addMonths(prevDate, 1) : subMonths(prevDate, 1)
    );
  };

  const currentMonthKey = format(currentDate, 'yyyy-MM');

  if (!data[currentMonthKey]) {
    const lastMonthKey = format(subMonths(currentDate, 1), 'yyyy-MM');
    const newMonthData = data[lastMonthKey]
      ? { ...data[lastMonthKey], expenses: [], childSupport: {...data[lastMonthKey].childSupport, status: 'Unpaid' as 'Unpaid' | 'Paid'} }
      : defaultMonthData;

    setData((prevData) => ({
      ...prevData,
      [currentMonthKey]: newMonthData,
    }));
  }

  const currentMonthData = data[currentMonthKey] || defaultMonthData;

  const updateMonthData = (updatedData: Partial<MonthData>) => {
    setData((prev) => ({
      ...prev,
      [currentMonthKey]: {
        ...prev[currentMonthKey],
        ...updatedData,
      },
    }));
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


  const addExpense = (newExpense: Omit<Expense, 'id'>) => {
    const expenseWithId = { ...newExpense, id: crypto.randomUUID() };
    updateMonthData({
      expenses: [...currentMonthData.expenses, expenseWithId],
    });
  };

  const deleteExpense = (expenseId: string) => {
    updateMonthData({
      expenses: currentMonthData.expenses.filter((exp) => exp.id !== expenseId),
    });
  };
  
  const updateExpense = (updatedExpense: Expense) => {
    updateMonthData({
      expenses: currentMonthData.expenses.map((exp) =>
        exp.id === updatedExpense.id ? updatedExpense : exp
      ),
    });
  };

  const updateChildSupport = (updatedChildSupport: ChildSupport) => {
    updateMonthData({ childSupport: updatedChildSupport });
  }


  const totalExpenses = currentMonthData.expenses.reduce(
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
                      expenses={currentMonthData.expenses}
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
                      expenses={currentMonthData.expenses}
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
                  expenses={currentMonthData.expenses}
                  childSupport={currentMonthData.childSupport}
                  expenseSplit={currentMonthData.expenseSplit}
                  onDelete={deleteExpense}
                  onUpdateExpense={updateExpense}
                  onUpdateChildSupport={updateChildSupport}
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
