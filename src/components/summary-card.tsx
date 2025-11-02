'use client';

import { HandCoins, Scale } from 'lucide-react';
import { useMemo } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Button } from './ui/button';
import { SettleBalanceDialog } from './settle-balance-dialog';
import { useAppContext } from '@/context/app-context';
import { parse, isBefore, startOfDay, format, isAfter, startOfMonth } from 'date-fns';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';

interface SummaryCardProps {
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

export function SummaryCard({
  parent,
  expenses,
  expenseSplit,
  medicalExpenseSplit,
  childSupport,
  parentNames,
  appData,
  currentMonthId,
}: SummaryCardProps) {
  const { updateExpense, updateChildSupport } = useAppContext();
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

        const unsettledExpenses = monthData.expenses.filter(
          (e) => e.status === 'Unsettled'
        );
        
        const unsettledPaidByParent = unsettledExpenses
          .filter((exp) => exp.paidBy === parent)
          .reduce((sum, exp) => sum + exp.amount, 0);

        const parentExpenseShare = calculateShare(
          unsettledExpenses,
          monthData.expenseSplit,
          monthData.medicalExpenseSplit,
          parent
        );
        const expenseBalance = unsettledPaidByParent - parentExpenseShare;

        let childSupportBalance = 0;
        const monthDate = parse(monthId, 'yyyy-MM', new Date());
        const isFutureMonth = isAfter(startOfMonth(monthDate), startOfMonth(new Date()));

        if (
          monthData.childSupport.status === 'Unsettled' &&
          monthData.childSupport.paidBy !== 'None' &&
          !isFutureMonth
        ) {
          if (monthData.childSupport.paidBy === parent) {
            // If I paid, it's a debit (money I paid out).
            childSupportBalance = -monthData.childSupport.amount;
          } else {
             // If they paid, it's a credit to me.
            childSupportBalance = monthData.childSupport.amount;
          }
        }
        
        return { monthId, balance: expenseBalance + childSupportBalance };
      })
      .filter((item) => item.balance !== 0);
  }, [appData.months, currentMonthId, parent]);

  const previousMonthsTotalBalance = previousBalances.reduce(
    (acc, curr) => acc + curr.balance,
    0
  );

  // --- Calculate Current Month's Balance ---
  const unsettledExpenses = expenses.filter((e) => e.status === 'Unsettled');

  const unsettledPaidByParent = unsettledExpenses
    .filter((exp) => exp.paidBy === parent)
    .reduce((sum, exp) => sum + exp.amount, 0);

  const parentExpenseShare = calculateShare(
    unsettledExpenses,
    expenseSplit,
    medicalExpenseSplit,
    parent
  );

  const expenseBalance = unsettledPaidByParent - parentExpenseShare;

  let childSupportBalance = 0;
  const currentMonthDate = parse(currentMonthId, 'yyyy-MM', new Date());
  const isCurrentMonthFuture = isAfter(startOfMonth(currentMonthDate), startOfMonth(new Date()));

  if (childSupport.status === 'Unsettled' && childSupport.paidBy !== 'None' && !isCurrentMonthFuture) {
     if (childSupport.paidBy === parent) {
      // If I am the payer, this is a debit (money I paid out)
      childSupportBalance = -childSupport.amount;
    } else {
      // If the other parent is the payer, this is a credit for me (money I received)
      childSupportBalance = childSupport.amount;
    }
  }

  const currentMonthNetBalance = expenseBalance + childSupportBalance;

  const totalNetBalance = previousMonthsTotalBalance + currentMonthNetBalance;

  const isSettled = totalNetBalance === 0;

  let transferDescription = 'All settled up';
  if (!isSettled) {
    if (totalNetBalance < 0) {
      transferDescription = `You Owe ${otherParentName}`;
    } else if (totalNetBalance > 0) {
      transferDescription = `${otherParentName} Owes You`;
    }
  }

  const isButtonDisabled = !(
    Object.values(appData.months).some((m) =>
      m.expenses.some((e) => e.status === 'Unsettled')
    ) ||
    Object.values(appData.months).some(
      (m) => {
        const monthDate = parse(m.id, 'yyyy-MM', new Date());
        const isFuture = isAfter(startOfMonth(monthDate), startOfMonth(new Date()));
        return m.childSupport.amount > 0 && m.childSupport.status === 'Unsettled' && !isFuture;
      }
    )
  );

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <Scale className="h-5 w-5 text-secondary-foreground" />
          </span>
          <div>
            <CardTitle>{parentNames[parent]}</CardTitle>
            <CardDescription>Monthly contribution summary.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="space-y-2 rounded-md bg-muted/30 p-3">
          <h4 className="font-medium text-sm underline">This Month's Balance</h4>
          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">Your Share of Expenses</p>
            <p className="font-semibold">-${parentExpenseShare.toFixed(2)}</p>
          </div>
          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">Unsettled Expenses You Paid</p>
            <p className="font-semibold text-green-600">
              +${unsettledPaidByParent.toFixed(2)}
            </p>
          </div>
          {childSupport.amount > 0 && childSupport.status === 'Unsettled' && !isCurrentMonthFuture && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">Child Support</p>
              <p
                className={cn(
                  'font-semibold',
                  childSupportBalance > 0 && 'text-green-600',
                  childSupportBalance < 0 && 'text-destructive'
                )}
              >
                {childSupportBalance >= 0
                  ? `+$${childSupportBalance.toFixed(2)}`
                  : `-$${Math.abs(childSupportBalance).toFixed(2)}`}
              </p>
            </div>
          )}
          <Separator />
          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">Your Net Balance for Month</p>
            <p
              className={cn(
                'font-semibold',
                currentMonthNetBalance > 0 && 'text-green-600',
                currentMonthNetBalance < 0 && 'text-destructive'
              )}
            >
              {currentMonthNetBalance >= 0
                ? `+$${currentMonthNetBalance.toFixed(2)}`
                : `-$${Math.abs(currentMonthNetBalance).toFixed(2)}`}
            </p>
          </div>
        </div>

        {previousBalances.length > 0 && (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-sm py-2">
                <div className="flex justify-between w-full pr-4">
                  <span className="font-medium">Balance from Previous Months</span>
                  <span
                    className={cn(
                      'font-semibold',
                      previousMonthsTotalBalance > 0 && 'text-green-600',
                      previousMonthsTotalBalance < 0 && 'text-destructive'
                    )}
                  >
                    {previousMonthsTotalBalance >= 0
                      ? `+$${previousMonthsTotalBalance.toFixed(2)}`
                      : `-$${Math.abs(previousMonthsTotalBalance).toFixed(2)}`}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1 pl-2 pr-1 pt-1 border-t">
                  {previousBalances.map(({ monthId, balance }) => (
                    <div
                      key={monthId}
                      className="flex items-center justify-between text-xs"
                    >
                      <p className="text-muted-foreground">
                        {format(parse(monthId, 'yyyy-MM', new Date()), 'MMMM yyyy')}
                      </p>
                      <p
                        className={cn(
                          'font-medium',
                          balance > 0 && 'text-green-600',
                          balance < 0 && 'text-destructive'
                        )}
                      >
                        {balance >= 0
                          ? `+$${balance.toFixed(2)}`
                          : `-$${Math.abs(balance).toFixed(2)}`}
                      </p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        <Separator />
        
        <div className="rounded-lg bg-secondary/50 p-4 text-center">
          <p className="text-base font-medium text-foreground">
            {transferDescription}
          </p>
          <p
            className={cn(
              'text-2xl font-bold',
              !isSettled && totalNetBalance < 0 && 'text-destructive',
              !isSettled && totalNetBalance > 0 && 'text-green-600'
            )}
          >
            {isSettled
              ? '$0.00'
              : totalNetBalance > 0
                ? `+$${totalNetBalance.toFixed(2)}`
                : `-$${Math.abs(totalNetBalance).toFixed(2)}`}
          </p>
        </div>
        <p className="pt-2 text-xs text-muted-foreground">
          This is the total outstanding balance based on all unsettled items
          from all months.
        </p>
      </CardContent>
      <CardFooter>
        <SettleBalanceDialog
          parent={parent}
          otherParent={otherParent}
          expenses={expenses}
          expenseSplit={expenseSplit}
          medicalExpenseSplit={medicalExpenseSplit}
          childSupport={childSupport}
          netBalance={currentMonthNetBalance}
          parentNames={parentNames}
          appData={appData}
          currentMonthId={currentMonthId}
        >
          <Button className="w-full" disabled={isButtonDisabled}>
            <HandCoins className="mr-2 h-4 w-4" />
            Settle Balance
          </Button>
        </SettleBalanceDialog>
      </CardFooter>
    </Card>
  );
}
