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
import type { ChildSupport, Expense, ExpenseSplit, Parent } from '@/lib/types';
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
}

export function SummaryCard({
  parent,
  totalExpenses,
  expenses,
  expenseSplit,
  childSupport,
  onUpdateExpense,
  onUpdateChildSupport,
}: SummaryCardProps) {
  const parentSplitPercentage = expenseSplit[parent];
  const otherParent = parent === 'Parent 1' ? 'Parent 2' : 'Parent 1';

  const totalExpensesPaidByParent = expenses
    .filter((exp) => exp.paidBy === parent)
    .reduce((sum, exp) => sum + exp.amount, 0);

  const childSupportPaidByParent =
    childSupport.paidBy === parent && childSupport.status !== 'Unpaid'
      ? childSupport.amount
      : 0;

  const totalPaidByParent = totalExpensesPaidByParent + childSupportPaidByParent;
  
  const pendingExpensesConfirmation = expenses
    .filter(
      (exp) => exp.status === 'Pending' && exp.paidBy === otherParent
    )
    .reduce((sum, exp) => {
       const expenseShareOwed = exp.amount * (parentSplitPercentage / 100);
       return sum + expenseShareOwed;
    }, 0);
  
  const pendingChildSupportConfirmation = (childSupport.status === 'Pending' && childSupport.paidBy === otherParent) ? childSupport.amount : 0;

  const pendingConfirmation = pendingExpensesConfirmation + pendingChildSupportConfirmation;


  const totalSettled = expenses
    .filter((exp) => exp.status === 'Paid')
    .reduce((sum, exp) => sum + exp.amount, 0)
    + (childSupport.status === 'Paid' ? childSupport.amount : 0);
  
  const unsettledExpenses = totalExpenses - expenses.filter(e => e.status === 'Paid').reduce((s, e) => s + e.amount, 0);

  const expenseShare = unsettledExpenses * (parentSplitPercentage / 100);
  
  const unsettledPaidByParent = expenses
    .filter((exp) => exp.paidBy === parent && exp.status !== 'Paid')
    .reduce((sum, exp) => sum + exp.amount, 0);

  let childSupportAdjustment = 0;
  if (childSupport.status !== 'Paid' && childSupport.paidBy !== 'None') {
    if (childSupport.paidBy === parent) {
      // This parent pays support, so it increases what they are owed or decreases what they owe
      childSupportAdjustment = childSupport.amount;
    } else {
      // This parent receives support, so it decreases what they are owed or increases what they owe
      childSupportAdjustment = -childSupport.amount;
    }
  }
  
  const netBalance = unsettledPaidByParent - expenseShare + childSupportAdjustment;

  let transferDescription: string;
  let buttonText = 'Settle Balance';
  let buttonDisabled = false;

  if (Math.abs(netBalance) < 0.01) {
    transferDescription = 'All settled up';
    buttonText = 'All Settled';
    buttonDisabled = true;
  } else if (netBalance > 0) {
    transferDescription = `${otherParent} owes you`;
  } else {
    transferDescription = `You owe ${otherParent}`;
  }


  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <Scale className="h-5 w-5 text-secondary-foreground" />
          </span>
          <div>
            <CardTitle>{parent}</CardTitle>
            <CardDescription>Monthly contribution summary.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            Your Share of Expenses ({parentSplitPercentage}%)
          </p>
          <p className="font-semibold">${(totalExpenses * (parentSplitPercentage / 100)).toFixed(2)}</p>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">Total You Paid Directly</p>
          <p className="font-semibold">${totalPaidByParent.toFixed(2)}</p>
        </div>
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">Pending Confirmation</p>
          <p className="font-semibold text-yellow-600">${pendingConfirmation.toFixed(2)}</p>
        </div>
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">Paid & Settled</p>
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
              netBalance < 0 && 'text-destructive',
              netBalance > 0 && 'text-green-600'
            )}
          >
            ${Math.abs(netBalance).toFixed(2)}
          </p>
        </div>
        <p className="pt-2 text-xs text-muted-foreground">
          This is the outstanding balance for the month based on unpaid and pending items.
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
        >
          <Button className="w-full">
            <HandCoins className="mr-2 h-4 w-4" />
            {buttonText}
          </Button>
        </SettleBalanceDialog>
      </CardFooter>
    </Card>
  );
}
