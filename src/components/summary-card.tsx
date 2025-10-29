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

interface SummaryCardProps {
  parent: Parent;
  totalExpenses: number;
  expenses: Expense[];
  expenseSplit: ExpenseSplit;
  childSupport: ChildSupport;
  onUpdateExpense: (expense: Expense) => void;
  onUpdateChildSupport: (childSupport: ChildSupport) => void;
  parentNames: ParentNames;
}

export function SummaryCard({
  parent,
  totalExpenses,
  expenses,
  expenseSplit,
  childSupport,
  onUpdateExpense,
  onUpdateChildSupport,
  parentNames,
}: SummaryCardProps) {
  const parentSplitPercentage = expenseSplit[parent];
  const otherParent = parent === 'Parent 1' ? 'Parent 2' : 'Parent 1';

  // Balance calculation is based on UNPAID items
  const unpaidExpenses = expenses.filter(e => e.status === 'Unpaid');
  const totalUnpaidExpenses = unpaidExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  
  const unpaidPaidByParent = unpaidExpenses
    .filter((exp) => exp.paidBy === parent)
    .reduce((sum, exp) => sum + exp.amount, 0);
    
  const parentExpenseShare = totalUnpaidExpenses * (parentSplitPercentage / 100);
  
  // This is the balance from shared expenses only.
  // Positive means you are owed money, negative means you owe money for expenses.
  const expenseBalance = unpaidPaidByParent - parentExpenseShare;

  let netBalance = expenseBalance;

  // Apply child support to the balance
  if (childSupport.status === 'Unpaid' && childSupport.paidBy !== 'None') {
      if (childSupport.paidBy === parent) {
        // You are the payer. This payment is a "credit" for you, reducing what you owe for other expenses.
        netBalance += childSupport.amount;
      } else {
        // You are the receiver. This amount is owed to you.
        netBalance -= childSupport.amount;
      }
  }


  const paidItems = expenses.filter((exp) => exp.status === 'Paid');
  const totalSettled = paidItems.reduce((sum, exp) => sum + exp.amount, 0) + (childSupport.status === 'Paid' ? childSupport.amount : 0);
  
  const otherParentName = parentNames[otherParent];

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

  const expensesPaidByParent = expenses
    .filter((exp) => exp.paidBy === parent)
    .reduce((sum, exp) => sum + exp.amount, 0);

  const childSupportPaidByThisParent = childSupport.paidBy === parent ? childSupport.amount : 0;
  const childSupportPaidByOtherParent = childSupport.paidBy === otherParent ? childSupport.amount : 0;


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
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            Your Share of Total Expenses ({parentSplitPercentage}%)
          </p>
          <p className="font-semibold">${(totalExpenses * (parentSplitPercentage / 100)).toFixed(2)}</p>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">Total Expenses You Paid</p>
          <p className="font-semibold">${expensesPaidByParent.toFixed(2)}</p>
        </div>
        
        {childSupportPaidByThisParent > 0 && (
            <div className="flex items-center justify-between">
            <p className="text-muted-foreground">Child Support You Paid</p>
            <p className="font-semibold">${childSupportPaidByThisParent.toFixed(2)}</p>
            </div>
        )}
        
        {childSupportPaidByOtherParent > 0 && (
             <div className="flex items-center justify-between">
             <p className="text-muted-foreground">Child Support Received</p>
             <p className="font-semibold text-green-600">+${childSupportPaidByOtherParent.toFixed(2)}</p>
             </div>
        )}
       
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">Total Paid & Settled This Month</p>
          <p className="font-semibold text-green-600">${totalSettled.toFixed(2)}</p>
        </div>

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
          childSupport={childSupport}
          onUpdateExpense={onUpdateExpense}
          onUpdateChildSupport={onUpdateChildSupport}
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
