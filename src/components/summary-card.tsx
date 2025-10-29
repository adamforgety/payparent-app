import { Scale } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { ChildSupport, ExpenseSplit, Parent } from '@/lib/types';

interface SummaryCardProps {
  parent: Parent;
  totalExpenses: number;
  expenseSplit: ExpenseSplit;
  childSupport: ChildSupport;
}

export function SummaryCard({
  parent,
  totalExpenses,
  expenseSplit,
  childSupport,
}: SummaryCardProps) {
  const parentSplit = expenseSplit[parent];
  const expenseShare = totalExpenses * (parentSplit / 100);

  let childSupportEffect = 0;
  let supportDescription = 'No contribution';
  if (childSupport.paidBy !== 'None') {
    if (childSupport.paidBy === parent) {
      childSupportEffect = -childSupport.amount;
      supportDescription = 'Payment sent';
    } else {
      childSupportEffect = childSupport.amount;
      supportDescription = 'Payment received';
    }
  }

  const netContribution = expenseShare;
  
  // The summary shows the parent's share of expenses.
  // The child support is a separate transfer. The prompt is about calculating contributions.
  // "Calculate each parent's contribution for the month". This is their share of expenses.
  // Child support is a fixed transfer on top of that. I will show them as separate items.

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
        <Separator />
        <div className="flex justify-between items-center">
            <p className="text-muted-foreground">Child Support</p>
            <div className='text-right'>
                <p className={`font-semibold ${childSupportEffect === 0 ? '' : childSupportEffect > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {childSupportEffect >= 0 ? '+' : '-'}${Math.abs(childSupportEffect).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">{supportDescription}</p>
            </div>
        </div>
        <Separator />
         <div className="flex justify-between items-center text-lg font-bold">
          <p>Total Contribution</p>
          <p className="text-primary">${(expenseShare).toFixed(2)}</p>
        </div>
        <p className="text-xs text-muted-foreground pt-2">
            This is the total share of this month's expenses. Child support is handled as a separate transfer between parents.
        </p>
      </CardContent>
    </Card>
  );
}
