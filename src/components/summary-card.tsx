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

  const totalPaidByParent = expenses
    .filter((exp) => exp.paidBy === parent)
    .reduce((sum, exp) => sum + exp.amount, 0);

  const expenseShare = totalExpenses * (parentSplitPercentage / 100);

  let childSupportAdjustment = 0;
  if (childSupport.paidBy !== 'None') {
    if (childSupport.paidBy === parent) {
      // This parent paid child support, so it increases their contribution
      childSupportAdjustment = childSupport.amount;
    } else {
      // This parent received child support, so it reduces their net contribution
      childSupportAdjustment = -childSupport.amount;
    }
  }

  // Net Balance: (What you paid) - (Your share of costs)
  // Your share of costs is your expense share + what you pay in child support.
  // If you receive child support, it reduces your share.
  const netBalance = totalPaidByParent - (expenseShare + childSupportAdjustment);

  let transferDescription: string;
  if (netBalance > 0) {
    transferDescription = `${otherParent} owes you`;
  } else if (netBalance < 0) {
    transferDescription = `You owe ${otherParent}`;
  } else {
    transferDescription = 'All settled up';
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
          <p className="font-semibold">${expenseShare.toFixed(2)}</p>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">Total You Paid Directly</p>
          <p className="font-semibold">${totalPaidByParent.toFixed(2)}</p>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">Child Support Adjustment</p>
          <p
            className={cn(
              'font-semibold',
              childSupportAdjustment === 0 && '',
              // If you PAY support, it's a positive adjustment (cost) to you, shown as green on other side
              childSupportAdjustment > 0 && 'text-red-600', 
              // If you RECEIVE support, it's a negative adjustment (credit) to you, shown as red on other side
              childSupportAdjustment < 0 && 'text-green-600'
            )}
          >
            {childSupportAdjustment >= 0
              ? `+ $${childSupportAdjustment.toFixed(2)}`
              : `- $${Math.abs(childSupportAdjustment).toFixed(2)}`}
          </p>
        </div>
        <Separator />
        <div className="rounded-lg bg-secondary/50 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            {transferDescription}
          </p>
          <p
            className={cn(
              'text-2xl font-bold',
              netBalance < 0 && 'text-red-600',
              netBalance > 0 && 'text-green-600'
            )}
          >
            ${Math.abs(netBalance).toFixed(2)}
          </p>
        </div>
        <p className="pt-2 text-xs text-muted-foreground">
          This is the net balance for the month. A positive amount means you are owed money.
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
          isEnabled={netBalance > 0}
        >
          <Button className="w-full" disabled={netBalance <= 0}>
            <HandCoins className="mr-2 h-4 w-4" />
            {netBalance > 0 ? 'Settle Balance' : 'Balance Settled'}
          </Button>
        </SettleBalanceDialog>
      </CardFooter>
    </Card>
  );
}
