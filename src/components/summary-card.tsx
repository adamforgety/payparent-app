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


  const totalPaidByParent = expenses
    .filter((exp) => exp.paidBy === parent)
    .reduce((sum, exp) => sum + exp.amount, 0);
    
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
  
  // Amount waiting for ME to confirm. This means the OTHER parent has paid and is waiting for my confirmation.
  const pendingYourConfirmationAmount =
    expenses
      .filter(
        (exp) => exp.status === 'Pending' && exp.paidBy === otherParent
      )
      .reduce((sum, exp) => sum + exp.amount * (expenseSplit[parent] / 100), 0) +
    (childSupport.status === 'Pending' && childSupport.paidBy === otherParent
      ? childSupport.amount
      : 0);

  // Amount I paid, waiting for the OTHER parent to confirm.
  const awaitingOtherParentConfirmationAmount =
    expenses
      .filter(
        (exp) => exp.status === 'Pending' && exp.paidBy === parent
      )
      .reduce((sum, exp) => sum + exp.amount * (expenseSplit[otherParent] / 100), 0) +
    (childSupport.status === 'Pending' && childSupport.paidBy === parent
      ? childSupport.amount
      : 0);


  const isSettled = netBalance === 0 && pendingYourConfirmationAmount === 0 && awaitingOtherParentConfirmationAmount === 0;
  let transferDescription = 'All settled up';
  const otherParentName = parentNames[otherParent];
  if (!isSettled) {
    if (netBalance > 0) {
        transferDescription = `You are owed by ${otherParentName}`;
    } else if (netBalance < 0) {
        transferDescription = `You owe ${otherParentName}`;
    } else if (pendingYourConfirmationAmount > 0 || awaitingOtherParentConfirmationAmount > 0) {
        transferDescription = "Payments are pending confirmation";
    }
  }
  
  const itemsOwedByMe = expenses.filter(e => e.paidBy === otherParent && e.status === 'Unpaid');
  const childSupportOwedByMe = (childSupport.paidBy === parent && childSupport.status === 'Unpaid') ? 1 : 0;

  const itemsToConfirm = expenses.filter(e => e.paidBy === otherParent && e.status === 'Pending');
  const childSupportToConfirm = (childSupport.paidBy === otherParent && childSupport.status === 'Pending') ? 1 : 0;
  const itemsToConfirmCount = itemsToConfirm.length + childSupportToConfirm;

  // I owe the other parent for expenses they paid, OR I owe child support
  const hasItemsToPay = expenses.some(e => e.paidBy === otherParent && e.status === 'Unpaid') || (childSupport.paidBy === parent && childSupport.status === 'Unpaid');
  // The other parent has paid for something and is waiting for my confirmation
  const hasItemsToConfirm = expenses.some(e => e.paidBy === otherParent && e.status === 'Pending') || (childSupport.paidBy === otherParent && childSupport.status === 'Pending');

  const isButtonDisabled = !hasItemsToPay && !hasItemsToConfirm;

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
        {pendingYourConfirmationAmount > 0 && (
           <div className="flex items-center justify-between text-sm">
            <p className="text-yellow-600">Pending Your Confirmation</p>
            <p className="font-semibold text-yellow-600">${pendingYourConfirmationAmount.toFixed(2)}</p>
          </div>
        )}
        {awaitingOtherParentConfirmationAmount > 0 && (
          <div className="flex items-center justify-between text-sm">
            <p className="text-blue-600">Awaiting Other Parent's Confirmation</p>
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
