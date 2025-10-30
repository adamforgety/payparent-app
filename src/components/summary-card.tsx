'use client';

import { HandCoins, Scale } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { ChildSupport, Expense, ExpenseSplit, Parent, ParentNames } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { SettleBalanceDialog } from './settle-balance-dialog';
import { useDashboard } from './dashboard-provider';

interface SummaryCardProps {
  parent: Parent;
  expenses: Expense[];
  expenseSplit: ExpenseSplit;
  medicalExpenseSplit: ExpenseSplit;
  childSupport: ChildSupport;
  parentNames: ParentNames;
}

export function SummaryCard({
  parent,
  expenses,
  expenseSplit,
  medicalExpenseSplit,
  childSupport,
  parentNames,
}: SummaryCardProps) {
  const { onUpdateExpense, onUpdateChildSupport } = useDashboard();
  const otherParent = parent === 'Parent 1' ? 'Parent 2' : 'Parent 1';
  const otherParentName = parentNames[otherParent];

  const unpaidExpenses = expenses.filter(e => e.status === 'Unpaid');
  
  const unpaidPaidByParent = unpaidExpenses
    .filter((exp) => exp.paidBy === parent)
    .reduce((sum, exp) => sum + exp.amount, 0);

  const calculateShare = (
    expenses: Expense[],
    split: ExpenseSplit,
    medicalSplit: ExpenseSplit,
    parent: Parent
  ): number => {
    let totalShare = 0;
    const parentSplitPercent = split[parent] / 100;
    const medicalParentSplitPercent = medicalSplit[parent] / 100;

    for (const expense of expenses) {
      if (expense.category === 'Medical') {
        totalShare += expense.amount * medicalParentSplitPercent;
      } else {
        totalShare += expense.amount * parentSplitPercent;
      }
    }
    return totalShare;
  };
    
  const parentExpenseShare = calculateShare(unpaidExpenses, expenseSplit, medicalExpenseSplit, parent);
  
  // This is the balance from shared expenses only.
  // Positive means you are owed money, negative means you owe money for expenses.
  const expenseBalance = unpaidPaidByParent - parentExpenseShare;

  let childSupportBalance = 0;
  if (childSupport.status === 'Unpaid' && childSupport.paidBy !== 'None') {
      if (childSupport.paidBy === parent) {
        // You are the payer. This amount is owed by you.
        childSupportBalance = -childSupport.amount;
      } else {
        // You are the receiver. This amount is owed to you.
        childSupportBalance = childSupport.amount;
      }
  }

  const netBalance = expenseBalance + childSupportBalance;
  
  const isSettled = netBalance === 0;
  
  let transferDescription = 'All settled up';
  if (!isSettled) {
    if (netBalance > 0) {
        transferDescription = `${otherParentName} owes you`;
    } else if (netBalance < 0) {
        transferDescription = `You owe ${otherParentName}`;
    }
  }
  
  const isButtonDisabled = !(
      expenses.some(e => e.status === 'Unpaid') ||
      (childSupport.amount > 0 && childSupport.status === 'Unpaid')
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
        
        <div className='space-y-2 rounded-md bg-muted/30 p-3'>
            <h4 className="font-medium text-sm">Shared Expense Balance</h4>
            <div className="flex items-center justify-between text-sm">
                <p className="text-muted-foreground">
                    Your Share
                </p>
                <p className="font-semibold">-${parentExpenseShare.toFixed(2)}</p>
            </div>
            <div className="flex items-center justify-between text-sm">
                <p className="text-muted-foreground">You Paid (unpaid items)</p>
                <p className="font-semibold text-green-600">+${unpaidPaidByParent.toFixed(2)}</p>
            </div>
             <Separator/>
             <div className="flex items-center justify-between text-sm">
                <p className="text-muted-foreground">Expense Balance</p>
                <p className={cn("font-semibold", expenseBalance > 0 && "text-green-600", expenseBalance < 0 && "text-destructive")}>
                    {expenseBalance >= 0 ? `$${expenseBalance.toFixed(2)}` : `-$${Math.abs(expenseBalance).toFixed(2)}`}
                </p>
            </div>
        </div>

        {childSupport.amount > 0 && childSupport.status === 'Unpaid' && (
            <div className='space-y-2 rounded-md bg-muted/30 p-3'>
                 <h4 className="font-medium text-sm">Child Support</h4>
                 <div className="flex items-center justify-between text-sm">
                    <p className="text-muted-foreground">
                        {childSupport.paidBy === parent ? 'You owe' : `${otherParentName} owes you`}
                    </p>
                    <p className={cn("font-semibold", childSupportBalance > 0 && 'text-green-600', childSupportBalance < 0 && 'text-destructive')}>
                        {childSupportBalance >= 0 ? `$${childSupportBalance.toFixed(2)}` : `-$${Math.abs(childSupportBalance).toFixed(2)}`}
                    </p>
                </div>
            </div>
        )}
       
        <Separator />
        <div className="rounded-lg bg-secondary/50 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            {transferDescription}
          </p>
          <p
            className={cn(
              'text-2xl font-bold',
               !isSettled && netBalance < 0 && 'text-destructive',
               !isSettled && netBalance > 0 && 'text-green-600'
            )}
          >
            ${Math.abs(netBalance).toFixed(2)}
          </p>
        </div>
        <p className="pt-2 text-xs text-muted-foreground">
          This is the outstanding balance for the month based on unpaid items.
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
          netBalance={netBalance}
          parentNames={parentNames}
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
