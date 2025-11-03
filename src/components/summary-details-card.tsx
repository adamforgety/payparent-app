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
  ExpenseSplit,
  Parent,
  ParentNames,
  MedicalExpenseSplit,
  AppData,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { ArrowDownCircle, ArrowUpCircle, Info, Circle } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';

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
  const otherParent = parent === 'Parent 1' ? 'Parent 2' : 'Parent 1';
  const otherParentName = parentNames[otherParent];

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
  
  const unsettledPaidByOtherParent = unsettledExpenses
    .filter(exp => exp.paidBy === otherParent)
    .reduce((sum, exp) => sum + exp.amount, 0);


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
    if (Math.abs(balance) < 0.01) return <Circle className="h-5 w-5 text-primary" />;
    if (balance > 0) return <ArrowUpCircle className="h-5 w-5 text-green-500" />;
    return <ArrowDownCircle className="h-5 w-5 text-destructive" />;
  };

  const amountYouOwe = parentExpenseShare - unsettledPaidByParent > 0 ? parentExpenseShare - unsettledPaidByParent : 0;
  const amountOwedToYou = unsettledPaidByParent - parentExpenseShare > 0 ? unsettledPaidByParent - parentExpenseShare : 0;


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
      <CardContent className="space-y-6">
        <ul className="space-y-4 text-lg">
          <li className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {renderBalanceIcon(amountOwedToYou)}
              <span className="text-base">{otherParentName} Owes You</span>
            </div>
            <div className="mx-4 flex-grow border-b border-dotted border-border"></div>
            <span className={cn("font-semibold text-lg", amountOwedToYou > 0 ? "text-green-600" : "text-muted-foreground")}>
              +${amountOwedToYou.toFixed(2)}
            </span>
          </li>
          <li className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {renderBalanceIcon(-amountYouOwe)}
              <span className="text-base">You Owe {otherParentName}</span>
            </div>
            <div className="mx-4 flex-grow border-b border-dotted border-border"></div>
            <span className={cn("font-semibold text-lg", amountYouOwe > 0 ? "text-destructive" : "text-muted-foreground")}>
              -${amountYouOwe.toFixed(2)}
            </span>
          </li>
           {childSupport.amount > 0 && childSupport.status === 'Unsettled' && !isCurrentMonthFuture && (
            <li className="flex items-center justify-between">
               <div className="flex items-center gap-3">
                {renderBalanceIcon(childSupportBalance)}
                <span className="text-base">Child Support</span>
              </div>
              <div className="mx-4 flex-grow border-b border-dotted border-border"></div>
              <span className={cn('font-semibold text-lg', childSupportBalance < 0 ? 'text-destructive' : 'text-green-600')}>
                {childSupportBalance < 0 ? `-$${Math.abs(childSupportBalance).toFixed(2)}` : `+$${childSupportBalance.toFixed(2)}`}
              </span>
            </li>
          )}
          {previousBalances.length > 0 && (
             <li className="w-full items-center justify-between">
               <Accordion type="single" collapsible className="w-full">
                 <AccordionItem value="item-1" className="border-b-0">
                    <AccordionTrigger className="flex w-full items-center p-0 text-base font-normal hover:no-underline [&>svg]:ml-2">
                        <div className="flex flex-1 items-center justify-between">
                          <div className="flex items-center gap-3">
                              {renderBalanceIcon(previousMonthsTotalBalance)}
                              <span className="text-base">Prior Balance</span>
                          </div>
                          <div className="mx-4 flex-grow border-b border-dotted border-border"></div>
                          <span className={cn('font-semibold text-lg', previousMonthsTotalBalance < 0 ? 'text-destructive' : 'text-green-600')}>
                          {previousMonthsTotalBalance < 0 ? `-$${Math.abs(previousMonthsTotalBalance).toFixed(2)}` : `+$${previousMonthsTotalBalance.toFixed(2)}`}
                          </span>
                        </div>
                    </AccordionTrigger>
                   <AccordionContent className="pt-2 pl-12 pr-4">
                     <div className="space-y-1">
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
                   </AccordionContent>
                 </AccordionItem>
               </Accordion>
            </li>
          )}
        </ul>
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
