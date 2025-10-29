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
import type { ChildSupport, ExpenseSplit, Parent, Expense } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { SettleBalanceDialog } from './settle-balance-dialog';
import { useMemo } from 'react';

interface SummaryCardProps {
  parent: Parent;
  totalExpenses: number;
  expenses: Expense[];
  expenseSplit: ExpenseSplit;
  childSupport: ChildSupport;
  onUpdateExpense: (expense: Expense) => void;
}

export function SummaryCard({
  parent,
  totalExpenses,
  expenses,
  expenseSplit,
  childSupport,
  onUpdateExpense,
}: SummaryCardProps) {
  const parentSplitPercentage = expenseSplit[parent];
  
  // Calculate total amount this parent has paid directly
  const totalPaidByParent = expenses
    .filter((exp) => exp.paidBy === parent)
    .reduce((sum, exp) => sum + exp.amount, 0);

  // This parent's share of the total expenses
  const expenseShare = totalExpenses * (parentSplitPercentage / 100);

  // Determine child support obligation
  let childSupportAdjustment = 0;
  if (childSupport.paidBy === parent) {
    // This parent PAYS child support, so it's an added cost for them
    childSupportAdjustment = childSupport.amount;
  } else if (childSupport.paidBy !== 'None') {
    // This parent RECEIVES child support, so it's a credit
    childSupportAdjustment = -childSupport.amount;
  }

  // Final balance:
  // A positive balance means they are owed money.
  // A negative balance means they owe money.
  const netBalance = totalPaidByParent - (expenseShare + childSupportAdjustment);

  const otherParent = parent === 'Parent 1' ? 'Parent 2' : 'Parent 1';

  let transferDescription: string;
  let balanceDescription: string;

  if (netBalance > 0) {
    transferDescription = `${otherParent} owes you`;
    balanceDescription = "You've paid more than your total share.";
  } else if (netBalance < 0) {
    transferDescription = `You owe ${otherParent}`;
    balanceDescription = "Your payments are less than your total share.";
  } else {
    transferDescription = 'All settled up';
    balanceDescription = "You've paid your exact share.";
  }

  const expensesOwedByOtherParent = useMemo(() => {
    // These are expenses paid by `parent` that `otherParent` needs to contribute to.
    // We only care about `Unpaid` expenses.
    return expenses.filter(exp => exp.paidBy === parent && exp.status === 'Unpaid');
  }, [expenses, parent]);

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
      <CardContent className="space-y-4 flex-grow">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground">Your Share of Expenses ({parentSplitPercentage}%)</p>
          <p className="font-semibold">${expenseShare.toFixed(2)}</p>
        </div>
         <div className="flex justify-between items-center">
          <p className="text-muted-foreground">Total You Paid Directly</p>
          <p className="font-semibold">${totalPaidByParent.toFixed(2)}</p>
        </div>
        <div className="flex justify-between items-center">
            <p className="text-muted-foreground">Child Support Adjustment</p>
            <p className={cn(
                "font-semibold",
                childSupportAdjustment === 0 && "",
                childSupportAdjustment > 0 && "text-red-600",
                childSupportAdjustment < 0 && "text-green-600"
            )}>
                {childSupportAdjustment >= 0 ? `$${childSupportAdjustment.toFixed(2)}` : `-$${Math.abs(childSupportAdjustment).toFixed(2)}`}
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
            This is the net balance for the month, calculated as: (Total You Paid) - (Your Expense Share + Your Child Support Adjustment). A positive amount means you are owed money.
        </p>
      </CardContent>
       <CardFooter>
        {netBalance > 0 && (
          <SettleBalanceDialog
            parent={parent}
            otherParent={otherParent}
            expenses={expensesOwedByOtherParent}
            expenseSplit={expenseSplit}
            onUpdateExpense={onUpdateExpense}
          >
            <Button className="w-full">
              <HandCoins className="mr-2" />
              Settle Balance
            </Button>
          </SettleBalanceDialog>
        )}
      </CardFooter>
    </Card>
  );
}
