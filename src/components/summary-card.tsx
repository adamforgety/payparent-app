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
  const parentSplit = expenseSplit[parent];
  const expenseShare = totalExpenses * (parentSplit / 100);
  const totalPaidByParent = expenses.filter(exp => exp.paidBy === parent).reduce((sum, exp) => sum + exp.amount, 0);

  let childSupportEffect = 0;
  if (childSupport.paidBy !== 'None') {
    if (childSupport.paidBy === parent) {
      childSupportEffect = -childSupport.amount;
    } else {
      childSupportEffect = childSupport.amount;
    }
  }

  const netBalance = totalPaidByParent - expenseShare - childSupportEffect;
  
  let balanceDescription = "Amount you've paid is less than your share.";
  if(netBalance > 0) balanceDescription = "You've paid more than your share.";
  if(netBalance === 0) balanceDescription = "All settled up.";

  const otherParent = parent === 'Parent 1' ? 'Parent 2' : 'Parent 1';
  let transferDescription = `Owes ${otherParent}`;
  if(netBalance < 0) transferDescription = `Receives from ${otherParent}`;
  if(netBalance === 0) transferDescription = "No transfer needed";


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
          <p className="text-muted-foreground">Share of Expenses ({parentSplit}%)</p>
          <p className="font-semibold">${expenseShare.toFixed(2)}</p>
        </div>
         <div className="flex justify-between items-center">
          <p className="text-muted-foreground">Total Paid</p>
          <p className="font-semibold">${totalPaidByParent.toFixed(2)}</p>
        </div>
        <div className="flex justify-between items-center">
            <p className="text-muted-foreground">Child Support</p>
            <p className={`font-semibold ${childSupportEffect === 0 ? '' : childSupportEffect > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {childSupportEffect >= 0 ? '+' : '-'}${Math.abs(childSupportEffect).toFixed(2)}
            </p>
        </div>
        <Separator />
         <div className="rounded-lg bg-secondary/50 p-4 text-center">
            <p className="text-sm text-muted-foreground">{transferDescription}</p>
            <p className={cn(
                "text-2xl font-bold",
                netBalance > 0 && "text-red-600",
                netBalance < 0 && "text-green-600",
            )}>
              ${Math.abs(netBalance).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">{balanceDescription}</p>
        </div>
        <p className="text-xs text-muted-foreground pt-2">
            This is the net balance for the month. A positive amount indicates you are owed money, and a negative amount means you owe money to the other parent.
        </p>
      </CardContent>
    </Card>
  );
}
