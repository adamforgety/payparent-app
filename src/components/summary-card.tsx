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
import type { ChildSupport, Expense, ExpenseSplit, Parent, ParentNames, MedicalExpenseSplit, AppData } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { SettleBalanceDialog } from './settle-balance-dialog';
import { useAppContext } from '@/context/app-context';
import { parse, isBefore, startOfDay } from 'date-fns';

interface SummaryCardProps {
  parent: Parent;
  expenses: Expense[];
  expenseSplit: ExpenseSplit;
  medicalExpenseSplit: MedicalExpenseSplit;
  childSupport: ChildSupport;
  parentNames: ParentNames;
  appData: AppData;
  currentMonthId: string;
}

const calculateShare = (
  expenses: Expense[],
  split: ExpenseSplit,
  medicalSplit: MedicalExpenseSplit,
  p: Parent
): number => {
  let totalShare = 0;
  
  for (const expense of expenses) {
    if (expense.category === 'Reimbursement') {
      if (expense.paidBy !== p) {
        totalShare += expense.amount;
      }
    } else if (expense.category === 'Medical' || expense.category === 'Child Care') {
      const medicalParentSplitPercent = medicalSplit[p] / 100;
      totalShare += expense.amount * medicalParentSplitPercent;
    } else {
      const parentSplitPercent = split[p] / 100;
      totalShare += expense.amount * parentSplitPercent;
    }
  }
  return totalShare;
};

export function SummaryCard({
  parent,
  expenses,
  expenseSplit,
  medicalExpenseSplit,
  childSupport,
  parentNames,
  appData,
  currentMonthId,
}: SummaryCardProps) {
  const { updateExpense, updateChildSupport } = useAppContext();
  const otherParent = parent === 'Parent 1' ? 'Parent 2' : 'Parent 1';
  const otherParentName = parentNames[otherParent];

  // --- Calculate Balance from Previous Months ---
  const previousMonthsBalance = Object.keys(appData.months)
    .filter(monthId => {
      const monthDate = parse(monthId, 'yyyy-MM', new Date());
      const currentDate = parse(currentMonthId, 'yyyy-MM', new Date());
      return isBefore(startOfDay(monthDate), startOfDay(currentDate));
    })
    .reduce((totalBalance, monthId) => {
      const monthData = appData.months[monthId];
      if (!monthData) return totalBalance;
      
      const unsettledExpenses = monthData.expenses.filter(e => e.status === 'Unsettled');
      const unsettledPaidByParent = unsettledExpenses
        .filter(exp => exp.paidBy === parent)
        .reduce((sum, exp) => sum + exp.amount, 0);

      const parentExpenseShare = calculateShare(unsettledExpenses, monthData.expenseSplit, monthData.medicalExpenseSplit, parent);
      const expenseBalance = unsettledPaidByParent - parentExpenseShare;

      let childSupportBalance = 0;
      // Only factor in past child support if it's explicitly settled.
      if (monthData.childSupport.status === 'Settled' && monthData.childSupport.paidBy !== 'None') {
        if (monthData.childSupport.paidBy === parent) {
          childSupportBalance = -monthData.childSupport.amount;
        } else {
          childSupportBalance = monthData.childSupport.amount;
        }
      }
      
      return totalBalance + expenseBalance + childSupportBalance;
    }, 0);


  // --- Calculate Current Month's Balance ---
  const unsettledExpenses = expenses.filter(e => e.status === 'Unsettled');
  
  const unsettledPaidByParent = unsettledExpenses
    .filter((exp) => exp.paidBy === parent)
    .reduce((sum, exp) => sum + exp.amount, 0);
  
  const parentExpenseShare = calculateShare(unsettledExpenses, expenseSplit, medicalExpenseSplit, parent);
  
  const expenseBalance = unsettledPaidByParent - parentExpenseShare;

  let childSupportBalance = 0;
  if (childSupport.status === 'Unsettled' && childSupport.paidBy !== 'None') {
      if (childSupport.paidBy === parent) {
        childSupportBalance = -childSupport.amount;
      } else {
        childSupportBalance = childSupport.amount;
      }
  }

  const currentMonthNetBalance = expenseBalance + childSupportBalance;
  
  const totalNetBalance = previousMonthsBalance + currentMonthNetBalance;

  const isSettled = totalNetBalance === 0;
  
  let transferDescription = 'All settled up';
  if (!isSettled) {
    if (totalNetBalance > 0) {
        transferDescription = `${otherParentName} owes you`;
    } else if (totalNetBalance < 0) {
        transferDescription = `You owe ${otherParentName}`;
    }
  }
  
  const isButtonDisabled = !(
      Object.values(appData.months).some(m => m.expenses.some(e => e.status === 'Unsettled')) ||
      Object.values(appData.months).some(m => m.childSupport.amount > 0 && m.childSupport.status === 'Unsettled')
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
        
        <div className='space-y-2 rounded-md bg-muted/30 p-3'>
            <h4 className="font-medium text-sm">This Month's Balance</h4>
            <div className="flex items-center justify-between text-sm">
                <p className="text-muted-foreground">
                    Your Share
                </p>
                <p className="font-semibold">-${parentExpenseShare.toFixed(2)}</p>
            </div>
            <div className="flex items-center justify-between text-sm">
                <p className="text-muted-foreground">You Paid (unsettled items)</p>
                <p className="font-semibold text-green-600">+${unsettledPaidByParent.toFixed(2)}</p>
            </div>
             {childSupport.amount > 0 && childSupport.status === 'Unsettled' && (
                <div className="flex items-center justify-between text-sm">
                    <p className="text-muted-foreground">
                        Child Support
                    </p>
                    <p className={cn("font-semibold", childSupportBalance > 0 && 'text-green-600', childSupportBalance < 0 && 'text-destructive')}>
                        {childSupportBalance >= 0 ? `$${childSupportBalance.toFixed(2)}` : `-$${Math.abs(childSupportBalance).toFixed(2)}`}
                    </p>
                </div>
             )}
             <Separator/>
             <div className="flex items-center justify-between text-sm">
                <p className="text-muted-foreground">Current Month Net</p>
                <p className={cn("font-semibold", currentMonthNetBalance > 0 && "text-green-600", currentMonthNetBalance < 0 && "text-destructive")}>
                    {currentMonthNetBalance >= 0 ? `$${currentMonthNetBalance.toFixed(2)}` : `-$${Math.abs(currentMonthNetBalance).toFixed(2)}`}
                </p>
            </div>
        </div>

        <Separator />
        
        <div className="space-y-2 text-sm">
           <div className="flex items-center justify-between">
              <p className="text-muted-foreground">Balance from Previous Months</p>
              <p className={cn("font-semibold", previousMonthsBalance > 0 && "text-green-600", previousMonthsBalance < 0 && "text-destructive")}>
                {previousMonthsBalance >= 0 ? `$${previousMonthsBalance.toFixed(2)}` : `-$${Math.abs(previousMonthsBalance).toFixed(2)}`}
              </p>
           </div>
           <div className="flex items-center justify-between text-base">
              <p className="font-semibold">Total Net Balance</p>
               <p className={cn("font-bold", !isSettled && totalNetBalance > 0 && "text-green-600", !isSettled && totalNetBalance < 0 && "text-destructive")}>
                {totalNetBalance >= 0 ? `$${totalNetBalance.toFixed(2)}` : `-$${Math.abs(totalNetBalance).toFixed(2)}`}
              </p>
           </div>
        </div>

        <div className="rounded-lg bg-secondary/50 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            {transferDescription}
          </p>
          <p
            className={cn(
              'text-2xl font-bold',
               !isSettled && totalNetBalance < 0 && 'text-destructive',
               !isSettled && totalNetBalance > 0 && 'text-green-600'
            )}
          >
            ${Math.abs(totalNetBalance).toFixed(2)}
          </p>
        </div>
        <p className="pt-2 text-xs text-muted-foreground">
          This is the total outstanding balance based on all unsettled items from all months.
        </p>
      </CardContent>
      <CardFooter>
         <SettleBalanceDialog
          parent={parent}
          otherParent={otherParent}
          expenses={expenses}
          expenseSplit={expenseSplit}
          medicalExpenseSplit={medicalExpenseSplit}
          childSupport={childSupport}
          netBalance={currentMonthNetBalance}
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
