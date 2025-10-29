'use client';

import { addMonths, format, subMonths } from 'date-fns';
import { useState } from 'react';

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

const defaultMonthData: MonthData = {
  childSupport: { amount: 0, paidBy: 'None', status: 'Unpaid' },
  expenseSplit: { 'Parent 1': 50, 'Parent 2': 50 },
  expenses: [],
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
    if (currentMonthData.childSupport.amount > 0 && currentMonthData.childSupport.paidBy === 'None') {
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
        currentDate={currentDate}
        onPreviousMonth={() => handleDateChange('prev')}
        onNextMonth={() => handleDateChange('next')}
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

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-3 no-print">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard">
            <div className="mt-8">
              <h2 className="text-2xl font-bold tracking-tight mb-4 sr-only">Monthly Summary</h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8 print-grid">
                <SummaryCard
                  parent="Parent 1"
                  totalExpenses={totalExpenses}
                  expenses={currentMonthData.expenses}
                  expenseSplit={currentMonthData.expenseSplit}
                  childSupport={currentMonthData.childSupport}
                  onUpdateExpense={updateExpense}
                  onUpdateChildSupport={updateChildSupport}
                />
                <SummaryCard
                  parent="Parent 2"
                  totalExpenses={totalExpenses}
                  expenses={currentMonthData.expenses}
                  expenseSplit={currentMonthData.expenseSplit}
                  childSupport={currentMonthData.childSupport}
                  onUpdateExpense={updateExpense}
                  onUpdateChildSupport={updateChildSupport}
                />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="expenses">
             <div className="mt-6">
                <ExpensesCard
                  expenses={currentMonthData.expenses}
                  onDelete={deleteExpense}
                  currentDate={currentDate}
                >
                  <AddExpenseDialog onAddExpense={addExpense} />
                </ExpensesCard>
              </div>
          </TabsContent>
          <TabsContent value="settings">
            <div className="grid grid-cols-1 gap-6 lg:gap-8 mt-6">
               <ChildSupportCard
                childSupport={currentMonthData.childSupport}
                onUpdate={updateChildSupport}
              />
              <ParentSplitCard
                expenseSplit={currentMonthData.expenseSplit}
                onUpdate={(expenseSplit) => updateMonthData({ expenseSplit })}
              />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
