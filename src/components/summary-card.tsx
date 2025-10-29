import { Scale } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { ChildSupport, ExpenseSplit, Parent, Expense } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SummaryCardProps {
  parent: Parent;
  totalExpenses: number;
  expenses: Expense[];
  expenseSplit: ExpenseSplit;
  childSupport: ChildSupport;
}

export function SummaryCard({
  parent,
  totalExpenses,
  expenses,
  expenseSplit,
  childSupport,
}: SummaryCardProps) {
  const parentSplitPercentage = expenseSplit[parent];
  const expenseShare = totalExpenses * (parentSplitPercentage / 100);
  const totalPaidByParent = expenses
    .filter((exp) => exp.paidBy === parent)
    .reduce((sum, exp) => sum + exp.amount, 0);

  // Determine what this parent is responsible for paying in total
  let totalOwedByParent = expenseShare;

  // childSupport.paidBy is the one who PAYS support
  // If this parent is the one who pays support, their total obligation increases.
  if (childSupport.paidBy === parent) {
    totalOwedByParent += childSupport.amount;
  }

  // Calculate the net balance
  // A positive balance means they paid more than they owe (other parent owes them)
  // A negative balance means they paid less than they owe (they owe the other parent)
  const netBalance = totalPaidByParent - totalOwedByParent;
  
  const otherParent = parent === 'Parent 1' ? 'Parent 2' : 'Parent 1';

  let transferDescription: string;
  let balanceDescription: string;
  let amountDescription: string;

  if (netBalance > 0) {
    transferDescription = `Receives from ${otherParent}`;
    balanceDescription = "You've paid more than your total share.";
    amountDescription = `Amount to Receive`;
  } else if (netBalance < 0) {
    transferDescription = `Owes ${otherParent}`;
    balanceDescription = "Your payments are less than your total share.";
    amountDescription = `Amount Owed`;
  } else {
    transferDescription = "All settled up";
    balanceDescription = "You've paid your exact share.";
    amountDescription = 'Balance';
  }


  return (
    <Card>
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
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground">Your Share of Expenses ({parentSplitPercentage}%)</p>
          <p className="font-semibold">${expenseShare.toFixed(2)}</p>
        </div>
         <div className="flex justify-between items-center">
          <p className="text-muted-foreground">Total You Paid Directly</p>
          <p className="font-semibold">${totalPaidByParent.toFixed(2)}</p>
        </div>
        <div className="flex justify-between items-center">
            <p className="text-muted-foreground">Child Support</p>
            <p className={`font-semibold ${childSupport.paidBy === 'None' ? '' : childSupport.paidBy === parent ? 'text-red-600' : 'text-green-600'}`}>
                {childSupport.paidBy === 'None' ? '$0.00' : `${childSupport.paidBy === parent ? '-' : '+'}$${childSupport.amount.toFixed(2)}`}
            </p>
        </div>
        <Separator />
         <div className="rounded-lg bg-secondary/50 p-4 text-center">
            <p className="text-sm text-muted-foreground">{transferDescription}</p>
            <p className={cn(
                "text-2xl font-bold",
                netBalance < 0 && "text-red-600",
                netBalance > 0 && "text-green-600",
            )}>
              ${Math.abs(netBalance).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">{balanceDescription}</p>
        </div>
        <p className="text-xs text-muted-foreground pt-2">
            This is the net balance for the month. A positive amount means you are owed money, and a negative amount means you owe the other parent. This is calculated as (Total Paid) - (Expense Share + Child Support).
        </p>
      </CardContent>
    </Card>
  );
}
