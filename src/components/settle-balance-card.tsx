'use client';

import { Scale, ArrowRight } from 'lucide-react';
import { useMemo } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type {
  ChildSupport,
  Expense,
  ExpenseSplit,
  Parent,
  ParentNames,
  MedicalExpenseSplit,
  AppData,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { parse, isBefore, startOfDay, isAfter, startOfMonth } from 'date-fns';
import { Button } from './ui/button';

interface SettleBalanceCardProps {
  parent: Parent;
  expenses: Expense[];
  expenseSplit: ExpenseSplit;
  medicalExpenseSplit: MedicalExpenseSplit;
  childSupport: ChildSupport;
  parentNames: ParentNames;
  appData: AppData;
  currentMonthId: string;
  onGoToExpenses: (monthId: string) => void;
}

const calculateShare = (
  expenses: Expense[],
  split: ExpenseSplit,
  medicalSplit: MedicalExpenseSplit,
  p: Parent
): number => {
  let totalShare = 0;
  for (const expense of expenses) {
    if (expense.category === 'Medical' || expense.category === 'Child Care') {
      const medicalParentSplitPercent = medicalSplit[p] / 100;
      totalShare += expense.amount * medicalParentSplitPercent;
    } else {
      const parentSplitPercent = split[p] / 100;
      totalShare += expense.amount * parentSplitPercent;
    }
  }
  return totalShare;
};

export function SettleBalanceCard({
  parent,
  expenses,
  expenseSplit,
  medicalExpenseSplit,
  childSupport,
  parentNames,
  appData,
  currentMonthId,
  onGoToExpenses,
}: SettleBalanceCardProps) {
  const otherParent = parent === 'Parent 1' ? 'Parent 2' : 'Parent 1';
  const otherParentName = parentNames[otherParent];

  // --- Calculate Balance from Previous Months ---
  const previousMonthsTotalBalance = useMemo<number>(() => {
    return Object.keys(appData.months)
      .filter((monthId) => {
        const monthDate = parse(monthId, 'yyyy-MM', new Date());
        const currentDate = parse(currentMonthId, 'yyyy-MM', new Date());
        return isBefore(startOfDay(monthDate), startOfDay(currentDate));
      })
      .reduce((totalBalance, monthId) => {
        const monthData = appData.months[monthId];
        if (!monthData) return totalBalance;

        const unsettledExpenses = monthData.expenses.filter(e => e.status === 'Unsettled');
        
        const paidByParent = unsettledExpenses
          .filter((exp) => exp.paidBy === parent)
          .reduce((sum, exp) => sum + exp.amount, 0);

        const parentExpenseShare = calculateShare(
          unsettledExpenses,
          monthData.expenseSplit,
          monthData.medicalExpenseSplit,
          parent
        );
        const expenseBalance = paidByParent - parentExpenseShare;

        let childSupportBalance = 0;
        const monthDate = parse(monthId, 'yyyy-MM', new Date());
        const isFutureMonth = isAfter(startOfMonth(monthDate), startOfMonth(new Date()));

        if (monthData.childSupport.status === 'Unsettled' && monthData.childSupport.paidBy !== 'None' && !isFutureMonth) {
          if (monthData.childSupport.paidBy === parent) {
            childSupportBalance = -monthData.childSupport.amount;
          } else {
            childSupportBalance = monthData.childSupport.amount;
          }
        }
        
        return totalBalance + expenseBalance + childSupportBalance;
      }, 0);
  }, [appData.months, currentMonthId, parent]);


  const unsettledExpenses = expenses.filter(e => e.status === 'Unsettled');
  
  const paidByParent = unsettledExpenses
    .filter((exp) => exp.paidBy === parent)
    .reduce((sum, exp) => sum + exp.amount, 0);

  const parentExpenseShare = calculateShare(
    unsettledExpenses,
    expenseSplit,
    medicalExpenseSplit,
    parent
  );

  const currentMonthExpenseBalance = paidByParent - parentExpenseShare;


  let childSupportBalance = 0;
  const currentMonthDate = parse(currentMonthId, 'yyyy-MM', new Date());
  const isCurrentMonthFuture = isAfter(startOfMonth(currentMonthDate), startOfMonth(new Date()));
  if (childSupport.status === 'Unsettled' && childSupport.paidBy !== 'None' && !isCurrentMonthFuture) {
    if (childSupport.paidBy === parent) {
      childSupportBalance = -childSupport.amount;
    } else {
      childSupportBalance = childSupport.amount;
    }
  }

  const currentMonthNetBalance = currentMonthExpenseBalance + childSupportBalance;
  const totalNetBalance = previousMonthsTotalBalance + currentMonthNetBalance;
  const isSettled = Math.abs(totalNetBalance) < 0.01;

  let transferDescription = 'All settled up';
  if (!isSettled) {
    if (totalNetBalance < 0) {
      transferDescription = `You Owe ${otherParentName}`;
    } else {
      transferDescription = `${otherParentName} Owes You`;
    }
  }

  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <Scale className="h-5 w-5 text-secondary-foreground" />
          </span>
          <div>
            <CardTitle>Settle Balance</CardTitle>
            <CardDescription>Total outstanding balance.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col flex-grow items-center justify-center text-center">
        <div className="flex-grow" />
        <p className="text-base font-medium text-foreground">
            {transferDescription}
        </p>
        <p
            className={cn(
              'text-4xl font-bold tracking-tight',
              !isSettled && totalNetBalance < 0 && 'text-destructive',
              !isSettled && totalNetBalance > 0 && 'text-green-600'
            )}
          >
            {isSettled
              ? '$0.00'
              : `$${Math.abs(totalNetBalance).toFixed(2)}`}
          </p>
        <p className="pt-4 text-xs text-muted-foreground flex-grow">
          This balance includes all unsettled items from the current and prior months.
        </p>
      </CardContent>
       <CardFooter>
        <Button className="w-full" onClick={() => onGoToExpenses(currentMonthId)}>
          View &amp; Settle Expenses
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
