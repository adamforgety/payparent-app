'use client';

import { useMemo } from 'react';
import { parse, isBefore, startOfDay, isAfter, startOfMonth, format, getMonth } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type {
  ChildSupport,
  Expense,
  CustomSplit,
  Parent,
  ParentNames,
  AppData,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { ArrowDownCircle, ArrowUpCircle, Info, Circle } from 'lucide-react';

interface SummaryDetailsCardProps {
  parent: Parent;
  expenses: Expense[];
  customSplits: CustomSplit[];
  childSupport: ChildSupport;
  parentNames: ParentNames;
  appData: AppData;
  currentMonthId: string;
}

const calculateExpenseShare = (
  expenses: Expense[],
  customSplits: CustomSplit[] | undefined,
  p: Parent
): number => {
  let totalShare = 0;
  for (const expense of expenses) {
    if (expense.category === 'Reimbursement') {
      // Reimbursement logic: Non-payer is responsible for 100%
      totalShare += expense.paidBy === p ? 0 : expense.amount;
    } else {
      const applicableSplit = customSplits?.find(s => s.categories.includes(expense.category));
      const parentSplitPercent = applicableSplit ? applicableSplit.split[p] / 100 : 0.5;
      totalShare += expense.amount * parentSplitPercent;
    }
  }
  return totalShare;
};

type MonthBalance = {
  monthId: string;
  balance: number; // Perspective: Parent owes if positive
};

export function SummaryDetailsCard({
  parent,
  expenses,
  customSplits,
  childSupport,
  parentNames,
  appData,
  currentMonthId,
}: SummaryDetailsCardProps) {
  const otherParent = parent === 'Parent 1' ? 'Parent 2' : 'Parent 1';
  const otherParentName = parentNames[otherParent];

  // Helper to calculate total share for a specific month
  const calculateMonthTotals = (monthExpenses: Expense[], monthSplits: CustomSplit[], monthCS: ChildSupport, monthDate: Date) => {
    const unsettled = monthExpenses.filter(e => e.status === 'Unsettled');
    
    let p1Total = calculateExpenseShare(unsettled, monthSplits, 'Parent 1');
    let p2Total = calculateExpenseShare(unsettled, monthSplits, 'Parent 2');

    const today = startOfMonth(new Date());
    const monthIndex = getMonth(monthDate) + 1;
    const monthlyPayer = monthCS.monthlyPayer?.[monthIndex] ?? 'None';

    if (monthCS.status === 'Unsettled' && monthlyPayer !== 'None' && !isAfter(monthDate, today)) {
      if (monthlyPayer === 'Parent 1') p1Total += monthCS.amount;
      else if (monthlyPayer === 'Parent 2') p2Total += monthCS.amount;
    }

    return { p1Total, p2Total };
  };

  // 1. Calculate Current Month's Net Perspective
  const { p1Total: currentP1, p2Total: p2Current } = useMemo(() => {
    return calculateMonthTotals(expenses, customSplits, childSupport, parse(currentMonthId, 'yyyy-MM', new Date()));
  }, [expenses, customSplits, childSupport, currentMonthId]);

  const currentMonthNet = parent === 'Parent 1' ? (currentP1 - p2Current) : (p2Current - currentP1);

  // 2. Calculate Prior Months' Net Perspective
  const previousBalances = useMemo<MonthBalance[]>(() => {
    const today = startOfMonth(new Date());
    const currentViewDate = parse(currentMonthId, 'yyyy-MM', new Date());

    return Object.keys(appData.months)
      .sort()
      .filter((monthId) => {
        const monthDate = parse(monthId, 'yyyy-MM', new Date());
        return isBefore(monthDate, currentViewDate) && !isAfter(monthDate, today);
      })
      .map((monthId) => {
        const monthData = appData.months[monthId];
        const { p1Total, p2Total } = calculateMonthTotals(monthData.expenses, monthData.customSplits, monthData.childSupport, parse(monthId, 'yyyy-MM', new Date()));
        const net = parent === 'Parent 1' ? (p1Total - p2Total) : (p2Total - p1Total);
        return { monthId, balance: net };
      })
      .filter(item => Math.abs(item.balance) >= 0.01);
  }, [appData.months, currentMonthId, parent]);

  const previousMonthsTotalBalance = previousBalances.reduce((acc, curr) => acc + curr.balance, 0);
  const totalNetBalance = currentMonthNet + previousMonthsTotalBalance;

  const renderBalanceIcon = (balance: number) => {
    if (Math.abs(balance) < 0.01) return <Circle className="h-5 w-5 text-primary" />;
    if (balance < 0) return <ArrowUpCircle className="h-5 w-5 text-green-500" />;
    return <ArrowDownCircle className="h-5 w-5 text-destructive" />;
  };

  const priorBalanceTitle = useMemo(() => {
    if (Math.abs(previousMonthsTotalBalance) < 0.01) return "Past Balances Settled";
    return previousMonthsTotalBalance > 0 ? `You Owe ${otherParentName}` : `${otherParentName} Owes You`;
  }, [previousMonthsTotalBalance, otherParentName]);

  return (
    <Card className="h-full shadow-sm border-border/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <Info className="h-5 w-5 text-primary" />
          </span>
          <div>
            <CardTitle>Balance Details</CardTitle>
            <CardDescription>A reconciled summary of your ledger contributions.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Current Month Breakdown */}
        <div className="space-y-4">
          <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
            This Month's Reconciled Balance
          </h3>
          <ul className="space-y-4 text-lg border-l-2 border-primary/20 pl-4 ml-2">
            <li className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {renderBalanceIcon(-Math.max(0, -currentMonthNet))}
                <span className="text-base">{otherParentName} Owes You</span>
              </div>
              <div className="mx-4 flex-grow border-b border-dotted border-border"></div>
              <span className={cn("font-semibold text-lg", currentMonthNet < 0 ? "text-green-600" : "text-muted-foreground")}>
                +${Math.max(0, -currentMonthNet).toFixed(2)}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {renderBalanceIcon(Math.max(0, currentMonthNet))}
                <span className="text-base">You Owe {otherParentName}</span>
              </div>
              <div className="mx-4 flex-grow border-b border-dotted border-border"></div>
              <span className={cn("font-semibold text-lg", currentMonthNet > 0 ? "text-destructive" : "text-muted-foreground")}>
                -${Math.max(0, currentMonthNet).toFixed(2)}
              </span>
            </li>
          </ul>
        </div>
        
        {/* Prior Month Breakdown */}
        {previousBalances.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-base text-foreground">Prior Months' Balance</h3>
             <ul className="space-y-4 text-lg border-l-2 border-primary/20 pl-4 ml-2">
                <li className="w-full">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {renderBalanceIcon(previousMonthsTotalBalance)}
                            <span className="text-base font-medium">{priorBalanceTitle}</span>
                        </div>
                        <div className="mx-4 flex-grow border-b border-dotted border-border"></div>
                        <span className={cn('font-semibold text-lg', previousMonthsTotalBalance > 0 ? 'text-destructive' : 'text-green-600')}>
                          {previousMonthsTotalBalance > 0 ? `-$${Math.abs(previousMonthsTotalBalance).toFixed(2)}` : `+$${Math.abs(previousMonthsTotalBalance).toFixed(2)}`}
                        </span>
                    </div>
                    <div className="pt-3 space-y-2 pl-8">
                        {previousBalances.map(({ monthId, balance }) => (
                          <div key={monthId} className="flex items-center justify-between text-sm">
                            <p className="text-muted-foreground">{format(parse(monthId, 'yyyy-MM', new Date()), 'MMMM yyyy')}</p>
                            <div className="mx-4 flex-grow border-b border-dotted border-border"></div>
                            <p className={cn('font-medium', balance > 0 ? 'text-destructive' : 'text-green-600')}>
                              {balance > 0 ? `-$${Math.abs(balance).toFixed(2)}` : `+$${Math.abs(balance).toFixed(2)}`}
                            </p>
                          </div>
                        ))}
                    </div>
                </li>
              </ul>
          </div>
        )}

        <Separator />
        
        {/* Grand Total */}
        <div className="flex items-center justify-between bg-muted/30 p-4 rounded-lg">
          <span className="font-bold text-lg">Total Net Balance</span>
           <span className={cn('text-3xl font-bold', totalNetBalance > 0 ? 'text-destructive' : totalNetBalance < 0 ? 'text-green-600' : 'text-primary')}>
                {totalNetBalance > 0 ? `-$${Math.abs(totalNetBalance).toFixed(2)}` : `+$${Math.abs(totalNetBalance).toFixed(2)}`}
            </span>
        </div>
      </CardContent>
    </Card>
  );
}