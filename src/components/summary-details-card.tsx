'use client';

import { useMemo } from 'react';
import { parse, isBefore, startOfDay, format, isAfter, startOfMonth } from 'date-fns';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
import { Info } from 'lucide-react';

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
  const expenseBalance = unsettledPaidByParent - parentExpenseShare;

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

  const currentMonthNetBalance = expenseBalance + childSupportBalance;
  
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
        <div className="space-y-2 rounded-md bg-muted/50 p-3">
          <h4 className="font-medium text-sm underline">This Month's Unsettled Balance</h4>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 text-sm">
            <p className="text-muted-foreground">Your Share of Expenses</p>
            <p className="font-semibold text-right">-${parentExpenseShare.toFixed(2)}</p>
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 text-sm">
            <p className="text-muted-foreground">Expenses You Paid</p>
            <p className="font-semibold text-green-600 text-right">
              +${unsettledPaidByParent.toFixed(2)}
            </p>
          </div>
          {childSupport.amount > 0 && childSupport.status === 'Unsettled' && !isCurrentMonthFuture && (
            <div className="grid grid-cols-[auto_1fr] gap-x-4 text-sm">
              <p className="text-muted-foreground">Child Support</p>
              <p className={cn('font-semibold text-right', childSupportBalance > 0 && 'text-green-600', childSupportBalance < 0 && 'text-destructive')}>
                {childSupportBalance >= 0 ? `+$${childSupportBalance.toFixed(2)}` : `-$${Math.abs(childSupportBalance).toFixed(2)}`}
              </p>
            </div>
          )}
          <Separator />
          <div className="grid grid-cols-[auto_1fr] gap-x-4 font-medium">
            <p className="text-muted-foreground">Net for this Month</p>
            <p className={cn("text-right", currentMonthNetBalance > 0 && 'text-green-600', currentMonthNetBalance < 0 && 'text-destructive')}>
              {currentMonthNetBalance >= 0 ? `+$${currentMonthNetBalance.toFixed(2)}` : `-$${Math.abs(currentMonthNetBalance).toFixed(2)}`}
            </p>
          </div>
        </div>

        {previousBalances.length > 0 && (
          <div className="space-y-2 rounded-md bg-muted/50 p-3">
             <h4 className="font-medium text-sm underline">Unsettled Balance from Previous Months</h4>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1" className="border-b-0">
                <AccordionTrigger className="text-sm py-2 hover:no-underline">
                  <div className="grid grid-cols-[auto_1fr] gap-x-4 w-full pr-4 font-medium">
                    <span className="text-muted-foreground text-left">Total from Past Months</span>
                    <span className={cn('font-semibold text-right', previousMonthsTotalBalance > 0 && 'text-green-600', previousMonthsTotalBalance < 0 && 'text-destructive')}>
                      {previousMonthsTotalBalance >= 0 ? `+$${previousMonthsTotalBalance.toFixed(2)}` : `-$${Math.abs(previousMonthsTotalBalance).toFixed(2)}`}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-1 pl-2 pr-1 pt-2 border-t mt-2">
                    {previousBalances.map(({ monthId, balance }) => (
                      <div key={monthId} className="grid grid-cols-[auto_1fr] gap-x-4 text-xs">
                        <p className="text-muted-foreground text-left">
                          {format(parse(monthId, 'yyyy-MM', new Date()), 'MMMM yyyy')}
                        </p>
                        <p className={cn('font-medium text-right', balance > 0 && 'text-green-600', balance < 0 && 'text-destructive')}>
                          {balance >= 0 ? `+$${balance.toFixed(2)}` : `-$${Math.abs(balance).toFixed(2)}`}
                        </p>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
