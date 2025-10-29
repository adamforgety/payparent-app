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

  const expensesPaidByParent = expenses
    .filter((exp) => exp.paidBy === parent)
    .reduce((sum, exp) => sum + exp.amount, 0);

  const childSupportPaidByParent =
    childSupport.status === 'Paid' && childSupport.paidBy === parent ? childSupport.amount : 0;
  
  const totalPaidByParent = expensesPaidByParent + childSupportPaidByParent;

  const unsettledExpenses = expenses.filter(e => e.status !== 'Paid');

  const unsettledPaidByParent = unsettledExpenses
    .filter((exp) => exp.paidBy === parent)
    .reduce((sum, exp) => sum + exp.amount, 0);
  
  const totalUnsettledExpenses = unsettledExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const expenseShare = totalUnsettledExpenses * (parentSplitPercentage / 100);

  let childSupportAdjustment = 0;
  if (childSupport.status !== 'Paid' && childSupport.paidBy !== 'None') {
    if (childSupport.paidBy === parent) {
      // I am the payer, so I owe this amount. It's a negative adjustment to my balance.
      childSupportAdjustment = -childSupport.amount;
    } else {
      // The other parent is the payer, so I am owed this amount. It's a positive adjustment.
      childSupportAdjustment = childSupport.amount;
    }
  }

  const netBalance = (unsettledPaidByParent - expenseShare) + childSupportAdjustment;

  const paidAndSettledExpenses = expenses.filter((exp) => exp.status === 'Paid');
  const totalSettled = paidAndSettledExpenses.reduce((sum, exp) => sum + exp.amount, 0) + (childSupport.status === 'Paid' ? childSupport.amount : 0);
  
  const otherParentName = parentNames[otherParent];

  // Logic for confirmation messages
  let awaitingYourConfirmationAmount = 0;
  let awaitingOtherParentConfirmationAmount = 0;

  const pendingExpenses = expenses.filter((e) => e.status === 'Pending');

  pendingExpenses.forEach((item) => {
    // If other parent paid, it's awaiting YOUR confirmation
    if (item.paidBy === otherParent) {
      awaitingYourConfirmationAmount += item.amount * (expenseSplit[parent] / 100);
    }
    // If you paid, it's awaiting THE OTHER PARENT'S confirmation
    else if (item.paidBy === parent) {
      awaitingOtherParentConfirmationAmount += item.amount * (expenseSplit[otherParent] / 100);
    }
  });

  // Child support confirmation logic (remains correct)
  if (childSupport.status === 'Pending' && childSupport.amount > 0 && childSupport.paidBy !== 'None') {
    if (childSupport.paidBy === otherParent) {
      awaitingYourConfirmationAmount += childSupport.amount;
    } else if (childSupport.paidBy === parent) {
      awaitingOtherParentConfirmationAmount += childSupport.amount;
    }
  }


  const isSettled = netBalance === 0 && awaitingYourConfirmationAmount === 0 && awaitingOtherParentConfirmationAmount === 0;
  let transferDescription = 'All settled up';
  if (!isSettled) {
    if (netBalance > 0) {
        transferDescription = `${otherParentName} owes you`;
    } else if (netBalance < 0) {
        transferDescription = `You owe ${otherParentName}`;
    } else if (awaitingYourConfirmationAmount > 0 || awaitingOtherParentConfirmationAmount > 0) {
        transferDescription = "Payments are pending confirmation";
    }
  }
  
  const isButtonDisabled = !(
      expenses.some(e => e.status === 'Unpaid' || e.status === 'Pending') ||
      (childSupport.amount > 0 && (childSupport.status === 'Unpaid' || childSupport.status === 'Pending'))
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
        {awaitingYourConfirmationAmount > 0 && (
           <div className="flex items-center justify-between text-sm">
            <p className="text-yellow-600">Awaiting Your Confirmation</p>
            <p className="font-semibold text-yellow-600">${awaitingYourConfirmationAmount.toFixed(2)}</p>
          </div>
        )}
        {awaitingOtherParentConfirmationAmount > 0 && (
          <div className="flex items-center justify-between text-sm">
            <p className="text-blue-600">Awaiting {otherParentName}'s Confirmation</p>
            <p className="font-semibold text-blue-600">${awaitingOtherParentConfirmationAmount.toFixed(2)}</p>
          </div>
        )}
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
