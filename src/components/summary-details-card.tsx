'use client';

import { useMemo } from 'react';
import { parse, isBefore, startOfDay, isAfter, startOfMonth } from 'date-fns';
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
  ExpenseSplit,
  Parent,
  ParentNames,
  MedicalExpenseSplit,
  AppData,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { ArrowDownCircle, ArrowUpCircle, Info, Circle } from 'lucide-react';

interface SummaryDetailsCardProps {
  parent: Parent;
  expenses: Expense[];
  expenseSplit: ExpenseSplit;
  medicalExpenseSplit: MedicalExpenseSplit;
  childSupport: ChildSupport;
  parentNames: ParentNames;
  appData: AppData;
  currentMonthId: string;
}

const calculateShare = (
  expenses: Expense[],
  split: ExpenseSplit,
  medicalSplit: MedicalExpenseSplit,
  p: Parent
): number => {
  let totalShare = 0;
  for (const expense of expenses) {
    if (expense.category === 'Reimbursement') {
      if (expense.paidBy !== p) {
        totalShare += expense.amount;
      }
    } else if (expense.category === 'Medical' || expense.category === 'Child Care') {
      const medicalParentSplitPercent = medicalSplit[p] / 100;
      totalShare += expense.amount * medicalParentSplitPercent;
    } else {
      const parentSplitPercent = split[p] / 100;
      totalShare += expense.amount * parentSplitPercent;
    }
  }
  return totalShare;
};

type PreviousBalance = {
  monthId: string;
  balance: number;
};

export function SummaryDetailsCard({
  parent,
  expenses,
  expenseSplit,
  medicalExpenseSplit,
  childSupport,
  parentNames,
  appData,
  currentMonthId,
}: SummaryDetailsCardProps) {

  // --- Calculate Balance from Previous Months ---
  const previousBalances = useMemo<PreviousBalance[]>(() => {
    return Object.keys(appData.months)
      .sort()
      .filter((monthId) => {
        const monthDate = parse(monthId, 'yyyy-MM', new Date());
        const currentDate = parse(currentMonthId, 'yyyy-MM', new Date());
        return isBefore(startOfDay(monthDate), startOfDay(currentDate));
      })
      .map((monthId) => {
        const monthData = appData.months[monthId];
        if (!monthData) return { monthId, balance: 0 };

        const unsettledExpenses = monthData.expenses.filter(e => e.status === 'Unsettled');
        const unsettledPaidByParent = unsettledExpenses
          .filter(exp => exp.paidBy === parent)
          .reduce((sum, exp) => sum + exp.amount, 0);

        const parentExpenseShare = calculateShare(unsettledExpenses, monthData.expenseSplit, monthData.medicalExpenseSplit, parent);
        const expenseBalance = unsettledPaidByParent - parentExpenseShare;

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
        
        return { monthId, balance: expenseBalance + childSupportBalance };
      })
      .filter(item => Math.abs(item.balance) >= 0.01);
  }, [appData.months, currentMonthId, parent]);
  
  const previousMonthsTotalBalance = previousBalances.reduce((acc, curr) => acc + curr.balance, 0);

  // --- Calculate Current Month's Balance ---
  const unsettledExpenses = expenses.filter(e => e.status === 'Unsettled');
  const unsettledPaidByParent = unsettledExpenses
    .filter(exp => exp.paidBy === parent)
    .reduce((sum, exp) => sum + exp.amount, 0);

  const parentExpenseShare = calculateShare(unsettledExpenses, expenseSplit, medicalExpenseSplit, parent);

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

  const totalNetBalance = previousMonthsTotalBalance + unsettledPaidByParent - parentExpenseShare + childSupportBalance;
  
  const renderBalanceIcon = (balance: number) => {
    if (balance > 0) return <ArrowUpCircle className="h-5 w-5 text-green-500" />;
    if (balance < 0) return <ArrowDownCircle className="h-5 w-5 text-destructive" />;
    return <Circle className="h-5 w-5 text-primary" />;
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <Info className="h-5 w-5 text-secondary-foreground" />
          </span>
          <div>
            <CardTitle>Balance Details</CardTitle>
            <CardDescription>A breakdown of your outstanding balance.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-3">
          <li className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {renderBalanceIcon(unsettledPaidByParent)}
              <span className="text-sm">Expenses You Covered</span>
            </div>
            <span className={cn("font-medium", unsettledPaidByParent > 0 ? "text-green-600" : "text-muted-foreground")}>
              +${unsettledPaidByParent.toFixed(2)}
            </span>
          </li>
          <li className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {renderBalanceIcon(-parentExpenseShare)}
              <span className="text-sm">Your Share of Costs</span>
            </div>
            <span className={cn("font-medium", parentExpenseShare > 0 ? "text-destructive" : "text-muted-foreground")}>
              -${parentExpenseShare.toFixed(2)}
            </span>
          </li>
           {childSupport.amount > 0 && childSupport.status === 'Unsettled' && !isCurrentMonthFuture && (
            <li className="flex items-center justify-between">
               <div className="flex items-center gap-2">
                {renderBalanceIcon(childSupportBalance)}
                <span className="text-sm">Child Support</span>
              </div>
              <span className={cn('font-medium', childSupportBalance < 0 ? 'text-destructive' : 'text-green-600')}>
                {childSupportBalance < 0 ? `-$${Math.abs(childSupportBalance).toFixed(2)}` : `+$${childSupportBalance.toFixed(2)}`}
              </span>
            </li>
          )}
          {previousBalances.length > 0 && (
             <li className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {renderBalanceIcon(previousMonthsTotalBalance)}
                <span className="text-sm">Balance from Prior Months</span>
              </div>
              <span className={cn('font-medium', previousMonthsTotalBalance < 0 ? 'text-destructive' : 'text-green-600')}>
                {previousMonthsTotalBalance < 0 ? `-$${Math.abs(previousMonthsTotalBalance).toFixed(2)}` : `+$${previousMonthsTotalBalance.toFixed(2)}`}
              </span>
            </li>
          )}
        </ul>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="font-semibold">Total Net Balance</span>
           <span className={cn('text-lg font-bold', totalNetBalance < 0 ? 'text-destructive' : totalNetBalance > 0 ? 'text-green-600' : 'text-primary')}>
                {totalNetBalance < 0 ? `-$${Math.abs(totalNetBalance).toFixed(2)}` : `+$${totalNetBalance.toFixed(2)}`}
            </span>
        </div>
      </CardContent>
    </Card>
  );
}
