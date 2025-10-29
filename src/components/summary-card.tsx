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
  const otherParentSplitPercentage = expenseSplit[otherParent];


  const totalPaidByParent = expenses
    .filter((exp) => exp.paidBy === parent)
    .reduce((sum, exp) => sum + exp.amount, 0)
    + (childSupport.paidBy === parent ? childSupport.amount : 0);
    
  const totalPaidByOtherParent = expenses
    .filter((exp) => exp.paidBy === otherParent)
    .reduce((sum, exp) => sum + exp.amount, 0)
     + (childSupport.paidBy === otherParent ? childSupport.amount : 0);

  const unsettledExpenses = expenses.filter(e => e.status !== 'Paid');

  const totalUnsettledAmount = unsettledExpenses.reduce((sum, exp) => sum + exp.amount, 0) + (childSupport.status !== 'Paid' ? childSupport.amount : 0);

  const unsettledPaidByParent = expenses
    .filter((exp) => exp.paidBy === parent && exp.status !== 'Paid')
    .reduce((sum, exp) => sum + exp.amount, 0);

  const expenseShare = unsettledExpenses.reduce((sum, exp) => sum + exp.amount, 0) * (parentSplitPercentage / 100);

  let childSupportAdjustment = 0;
    if (childSupport.status !== 'Paid' && childSupport.paidBy !== 'None') {
    if (childSupport.paidBy === parent) {
      // I am the payer, so I get "credit" for this amount
      childSupportAdjustment = childSupport.amount;
    } else {
      // The other parent is the payer, so I "owe" this amount
      childSupportAdjustment = -childSupport.amount;
    }
  }

  const netBalance = unsettledPaidByParent - expenseShare + childSupportAdjustment;

  const paidAndSettledExpenses = expenses.filter((exp) => exp.status === 'Paid');
  const totalSettled = paidAndSettledExpenses.reduce((sum, exp) => sum + exp.amount, 0) + (childSupport.status === 'Paid' ? childSupport.amount : 0);
  
  const pendingConfirmation = expenses
    .filter(
      (exp) => exp.status === 'Pending' && exp.paidBy === otherParent
    )
    .reduce((sum, exp) => {
       return sum + exp.amount * (parentSplitPercentage / 100);
    }, 0) + ((childSupport.status === 'Pending' && childSupport.paidBy === otherParent) ? childSupport.amount : 0);


  const isSettled = Math.abs(netBalance) < 0.01 && pendingConfirmation === 0;
  let transferDescription = 'All settled up';
  if (!isSettled) {
    transferDescription = netBalance > 0 ? `${otherParent} owes you` : `You owe ${otherParent}`;
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
               !isSettled && netBalance < 0 && 'text-destructive',
               !isSettled && netBalance > 0 && 'text-green-600'
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
          netBalance={netBalance}
        >
          <Button className="w-full">
            <HandCoins className="mr-2 h-4 w-4" />
            Settle Balance
          </Button>
        </SettleBalanceDialog>
      </CardFooter>
    </Card>
  );
}
