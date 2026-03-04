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
  CustomSplit,
  Parent,
  ParentNames,
  AppData,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { parse, isAfter, startOfMonth, getMonth } from 'date-fns';
import { Button } from './ui/button';

interface SettleBalanceCardProps {
  parent: Parent;
  expenses: Expense[];
  customSplits: CustomSplit[];
  childSupport: ChildSupport;
  parentNames: ParentNames;
  appData: AppData;
  currentMonthId: string;
  onGoToExpenses: (monthId: string) => void;
}

/**
 * Calculates how much one parent owes the other for a set of expenses.
 * A parent only owes for an expense if the OTHER parent was the initial payer.
 */
const calculateOwedAmount = (
  expenses: Expense[],
  customSplits: CustomSplit[] | undefined,
  p: Parent
): number => {
  let totalOwed = 0;
  const otherParent = p === 'Parent 1' ? 'Parent 2' : 'Parent 1';
  
  for (const expense of expenses) {
    // Only count as debt if the other parent paid
    if (expense.paidBy === otherParent) {
      if (expense.category === 'Reimbursement') {
        // Reimbursement logic: Non-payer owes 100%
        totalOwed += expense.amount;
      } else {
        const applicableSplit = customSplits?.find(s => s.categories.includes(expense.category));
        const parentSplitPercent = applicableSplit ? applicableSplit.split[p] / 100 : 0.5;
        totalOwed += expense.amount * parentSplitPercent;
      }
    }
  }
  return totalOwed;
};

export function SettleBalanceCard({
  parent,
  expenses,
  customSplits,
  childSupport,
  parentNames,
  appData,
  currentMonthId,
  onGoToExpenses,
}: SettleBalanceCardProps) {
  const otherParent = parent === 'Parent 1' ? 'Parent 2' : 'Parent 1';
  const otherParentName = parentNames[otherParent];

  /**
   * Calculates the net balance by summing Total P1 Debt and Total P2 Debt,
   * then subtracting them to find the reconciled difference.
   */
  const totalNetBalance = useMemo<number>(() => {
    let totalP1Debt = 0; // What P1 owes P2
    let totalP2Debt = 0; // What P2 owes P1

    const monthIds = Object.keys(appData.months);
    const today = startOfMonth(new Date());

    for (const monthId of monthIds) {
      const monthData = appData.months[monthId];
      if (!monthData) continue;

      const monthDate = parse(monthId, 'yyyy-MM', new Date());
      const isViewingCurrentOrPast = !isAfter(monthDate, parse(currentMonthId, 'yyyy-MM', new Date()));
      if (!isViewingCurrentOrPast) continue;

      // 1. Calculate Expense Debts for this month (only for unsettled items)
      const unsettledExpenses = monthData.expenses.filter(e => e.status === 'Unsettled');
      totalP1Debt += calculateOwedAmount(unsettledExpenses, monthData.customSplits, 'Parent 1');
      totalP2Debt += calculateOwedAmount(unsettledExpenses, monthData.customSplits, 'Parent 2');

      // 2. Calculate Child Support Debt for this month
      const isFutureMonth = isAfter(monthDate, today);
      const monthIndex = getMonth(monthDate) + 1;
      const monthlyPayer = monthData.childSupport.monthlyPayer?.[monthIndex] ?? 'None';

      if (monthData.childSupport.status === 'Unsettled' && monthlyPayer !== 'None' && !isFutureMonth) {
        if (monthlyPayer === 'Parent 1') {
          totalP1Debt += monthData.childSupport.amount;
        } else if (monthlyPayer === 'Parent 2') {
          totalP2Debt += monthData.childSupport.amount;
        }
      }
    }

    // Net Difference reconciliation: Parent 1 Debt - Parent 2 Debt
    const netDifference = totalP1Debt - totalP2Debt;
    
    // Return result from the perspective of the requested parent
    return parent === 'Parent 1' ? netDifference : -netDifference;
  }, [appData.months, currentMonthId, parent]);

  const isSettled = Math.abs(totalNetBalance) < 0.01;

  let transferDescription = 'All settled up';
  if (!isSettled) {
    if (totalNetBalance > 0) {
      transferDescription = `You Owe ${otherParentName}`;
    } else {
      transferDescription = `${otherParentName} Owes You`;
    }
  }

  return (
    <Card className="flex flex-col h-full shadow-md border-border/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <Scale className="h-5 w-5 text-primary" />
          </span>
          <div>
            <CardTitle>Settle Balance</CardTitle>
            <CardDescription>Total outstanding balance.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col flex-grow items-center justify-center text-center py-8">
        <div className="flex-grow" />
        <p className="text-base font-medium text-foreground mb-2">
            {transferDescription}
        </p>
        <p
            className={cn(
              'text-5xl font-bold tracking-tight',
              !isSettled && totalNetBalance > 0 && 'text-destructive',
              !isSettled && totalNetBalance < 0 && 'text-green-600'
            )}
          >
            {isSettled
              ? '$0.00'
              : `$${Math.abs(totalNetBalance).toFixed(2)}`}
          </p>
        <p className="pt-6 text-xs text-muted-foreground max-w-[200px]">
          Includes all unsettled items up to {parse(currentMonthId, 'yyyy-MM', new Date()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
        </p>
        <div className="flex-grow" />
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