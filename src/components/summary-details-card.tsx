
'use client';

import { useMemo } from 'react';
import { parse, isBefore, startOfDay, isAfter, startOfMonth, format } from 'date-fns';
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

const calculateShare = (
  expenses: Expense[],
  customSplits: CustomSplit[] | undefined,
  p: Parent
): number => {
  let totalShare = 0;
  for (const expense of expenses) {
    if (expense.category === 'Reimbursement') {
      // The parent who paid gets 0% of the share, the other parent gets 100%
      totalShare += expense.paidBy === p ? 0 : expense.amount;
    } else {
      const applicableSplit = customSplits?.find(s => s.categories.includes(expense.category));
      const parentSplitPercent = applicableSplit ? applicableSplit.split[p] / 100 : 0.5; // Default to 50% if no split found
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
  customSplits,
  childSupport,
  parentNames,
  appData,
  currentMonthId,
}: SummaryDetailsCardProps) {
  const otherParent = parent === 'Parent 1' ? 'Parent 2' : 'Parent 1';
  const otherParentName = parentNames[otherParent];

  // --- Calculate Balance from Previous Months ---
  const previousBalances = useMemo<PreviousBalance[]>(() => {
    const today = startOfDay(new Date());
    return Object.keys(appData.months)
      .sort()
      .filter((monthId) => {
        const monthDate = parse(monthId, 'yyyy-MM', new Date());
        const currentDate = parse(currentMonthId, 'yyyy-MM', new Date());
        // Only include months that are strictly before the current month being viewed
        // AND not in the future relative to today.
        return isBefore(startOfDay(monthDate), startOfDay(currentDate)) && !isAfter(monthDate, today);
      })
      .map((monthId) => {
        const monthData = appData.months[monthId];
        if (!monthData) return { monthId, balance: 0 };
        
        const hasUnsettledItems = 
            monthData.expenses.some(e => e.status === 'Unsettled') || 
            (monthData.childSupport.status === 'Unsettled' && monthData.childSupport.amount > 0 && !isAfter(startOfMonth(parse(monthId, 'yyyy-MM', new Date())), startOfMonth(new Date())));

        if (!hasUnsettledItems) {
            return { monthId, balance: 0 };
        }

        const unsettledExpenses = monthData.expenses.filter(e => e.status === 'Unsettled');
        
        const paidByParent = unsettledExpenses
          .filter((exp) => exp.paidBy === parent)
          .reduce((sum, exp) => sum + exp.amount, 0);

        const parentExpenseShare = calculateShare(
          unsettledExpenses,
          monthData.customSplits,
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
        
        return { monthId, balance: expenseBalance + childSupportBalance };
      })
      .filter(item => Math.abs(item.balance) >= 0.01);
  }, [appData.months, currentMonthId, parent]);
  
  const previousMonthsTotalBalance = previousBalances.reduce((acc, curr) => acc + curr.balance, 0);

  // --- Calculate Current Month's Balance ---
  const unsettledExpenses = expenses.filter(e => e.status === 'Unsettled');
  
  const paidByParent = unsettledExpenses
    .filter((exp) => exp.paidBy === parent)
    .reduce((sum, exp) => sum + exp.amount, 0);

  const parentExpenseShare = calculateShare(
    unsettledExpenses,
    customSplits,
    parent
  );

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

  // Positive value means the other parent owes you for this month.
  const currentMonthCredit = Math.max(0, paidByParent - parentExpenseShare) + (childSupportBalance > 0 ? childSupportBalance : 0);
  
  // Positive value means you owe the other parent for this month.
  const currentMonthDebit = Math.max(0, parentExpenseShare - paidByParent) + (childSupportBalance < 0 ? Math.abs(childSupportBalance) : 0);

  const totalNetBalance = currentMonthCredit - currentMonthDebit + previousMonthsTotalBalance;
  
  const renderBalanceIcon = (balance: number) => {
    if (Math.abs(balance) < 0.01) return <Circle className="h-5 w-5 text-primary" />;
    if (balance > 0) return <ArrowUpCircle className="h-5 w-5 text-green-500" />;
    return <ArrowDownCircle className="h-5 w-5 text-destructive" />;
  };

  const { title, description } = useMemo(() => {
    return {
        title: 'Balance Details',
        description: 'A summary of your financial contributions.'
    };
  }, []);

  const priorBalanceTitle = useMemo(() => {
    if (Math.abs(previousMonthsTotalBalance) < 0.01) {
      return "Past Balances Settled";
    }
    if (previousMonthsTotalBalance > 0) {
      return `${otherParentName} Owes You`;
    }
    return `You Owe ${otherParentName}`;
  }, [previousMonthsTotalBalance, otherParentName]);


  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <Info className="h-5 w-5 text-primary" />
          </span>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="font-semibold text-base text-foreground">This Month's Balance</h3>
          <ul className="space-y-4 text-lg border-l-2 border-border pl-4 ml-2">
            <li className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {renderBalanceIcon(currentMonthCredit)}
                <span className="text-base">{otherParentName} Owes You</span>
              </div>
              <div className="mx-4 flex-grow border-b border-dotted border-border"></div>
              <span className={cn("font-semibold text-lg", currentMonthCredit > 0 ? "text-green-600" : "text-muted-foreground")}>
                +${currentMonthCredit.toFixed(2)}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {renderBalanceIcon(-currentMonthDebit)}
                <span className="text-base">You Owe {otherParentName}</span>
              </div>
              <div className="mx-4 flex-grow border-b border-dotted border-border"></div>
              <span className={cn("font-semibold text-lg", currentMonthDebit > 0 ? "text-destructive" : "text-muted-foreground")}>
                -${currentMonthDebit.toFixed(2)}
              </span>
            </li>
          </ul>
        </div>
        
        {previousBalances.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-base text-foreground">Prior Month's Balance</h3>
             <ul className="space-y-4 text-lg border-l-2 border-border pl-4 ml-2">
                <li className="w-full items-center justify-between">
                    <div className="flex items-center gap-3">
                        {renderBalanceIcon(previousMonthsTotalBalance)}
                        <div className="flex flex-1 items-center justify-between text-base font-normal">
                            <span className="text-base">{priorBalanceTitle}</span>
                            <div className="mx-4 flex-grow border-b border-dotted border-border"></div>
                            <span className={cn('font-semibold text-lg', previousMonthsTotalBalance < 0 ? 'text-destructive' : previousMonthsTotalBalance > 0 ? 'text-green-600' : 'text-muted-foreground')}>
                              {previousMonthsTotalBalance < 0 ? `-$${Math.abs(previousMonthsTotalBalance).toFixed(2)}` : `+$${previousMonthsTotalBalance.toFixed(2)}`}
                            </span>
                        </div>
                    </div>
                    <div className="pt-2 space-y-1 pl-8">
                        {previousBalances.map(({ monthId, balance }) => (
                          <div key={monthId} className="flex items-center justify-between text-sm">
                            <p className="text-muted-foreground">{format(parse(monthId, 'yyyy-MM', new Date()), 'MMMM yyyy')}</p>
                            <div className="mx-4 flex-grow border-b border-dotted border-border"></div>
                            <p className={cn('font-medium', balance < 0 ? 'text-destructive' : 'text-green-600')}>
                              {balance < 0 ? `-$${Math.abs(balance).toFixed(2)}` : `+$${balance.toFixed(2)}`}
                            </p>
                          </div>
                        ))}
                    </div>
                </li>
              </ul>
          </div>
        )}

        <Separator />
        <div className="flex items-center justify-between">
          <span className="font-semibold text-lg">Total Net Balance</span>
           <span className={cn('text-2xl font-bold', totalNetBalance < 0 ? 'text-destructive' : totalNetBalance > 0 ? 'text-green-600' : 'text-primary')}>
                {totalNetBalance < 0 ? `-$${Math.abs(totalNetBalance).toFixed(2)}` : `+$${totalNetBalance.toFixed(2)}`}
            </span>
        </div>
      </CardContent>
    </Card>
  );
}
