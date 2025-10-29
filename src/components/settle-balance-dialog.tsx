'use client';

import { useState, useMemo } from 'react';
import { HandCoins } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import type { Expense, Parent, ExpenseSplit, ChildSupport } from '@/lib/types';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';

interface SettleBalanceDialogProps {
  parent: Parent;
  otherParent: Parent;
  expenses: Expense[];
  expenseSplit: ExpenseSplit;
  childSupport: ChildSupport;
  onUpdateExpense: (expense: Expense) => void;
  children: React.ReactNode;
}

export function SettleBalanceDialog({
  parent,
  otherParent,
  expenses,
  expenseSplit,
  childSupport,
  onUpdateExpense,
  children,
}: SettleBalanceDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);

  const otherParentSplit = expenseSplit[otherParent];

  const expensesToSettle = useMemo(() => {
    // These are expenses paid by `parent` that `otherParent` has not paid their share for.
    return expenses.filter(
      (exp) => exp.paidBy === parent && exp.status === 'Unpaid'
    );
  }, [expenses, parent]);

  const childSupportOwed = useMemo(() => {
    // Child support is owed to `parent` if `otherParent` is the payer.
    return childSupport.paidBy === otherParent ? childSupport.amount : 0;
  }, [childSupport, otherParent]);

  const totalOwedFromExpenses = expensesToSettle.reduce((acc, exp) => {
      const amountOwed = exp.amount * (otherParentSplit / 100);
      return acc + amountOwed;
  }, 0);

  const totalOwed = totalOwedFromExpenses + childSupportOwed;

  const handleToggleSelection = (expenseId: string) => {
    setSelectedExpenseIds((prev) =>
      prev.includes(expenseId)
        ? prev.filter((id) => id !== expenseId)
        : [...prev, expenseId]
    );
  };

  const handleMarkAllAsPaid = () => {
    expensesToSettle.forEach((exp) => {
      onUpdateExpense({ ...exp, status: 'Paid' });
    });
    setSelectedExpenseIds([]);
    setIsOpen(false);
  };

  const handleMarkSelectedAsPaid = () => {
    expensesToSettle.forEach((exp) => {
      if (selectedExpenseIds.includes(exp.id)) {
        onUpdateExpense({ ...exp, status: 'Paid' });
      }
    });
    setSelectedExpenseIds([]);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Settle Balance with {otherParent}</DialogTitle>
          <DialogDescription>
            These are the amounts {otherParent} owes you for this month. Mark expenses as paid once you've received the funds.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[400px] border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-secondary">
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead className="text-right">Amount Owed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {childSupportOwed > 0 && (
                <TableRow>
                    <TableCell></TableCell>
                    <TableCell>Child Support</TableCell>
                    <TableCell className="text-right">${childSupportOwed.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">${childSupportOwed.toFixed(2)}</TableCell>
                </TableRow>
              )}
              {expensesToSettle.length > 0 ? (
                expensesToSettle.map((expense) => {
                  const amountOwed =
                    expense.amount * (otherParentSplit / 100);
                  return (
                    <TableRow key={expense.id}>
                      <TableCell>
                        <Checkbox
                          id={`select-${expense.id}`}
                          checked={selectedExpenseIds.includes(expense.id)}
                          onCheckedChange={() =>
                            handleToggleSelection(expense.id)
                          }
                        />
                      </TableCell>
                      <TableCell>{expense.description}</TableCell>
                      <TableCell className="text-right">
                        ${expense.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${amountOwed.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                childSupportOwed === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      No unpaid expenses to settle.
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </ScrollArea>
        <div className="flex justify-end items-center gap-4 p-4 rounded-md bg-secondary/50 font-semibold">
            <span>Total Owed to You:</span>
            <span className="text-xl text-primary font-bold">${totalOwed.toFixed(2)}</span>
        </div>
        <DialogFooter className="sm:justify-between gap-2">
            <div>
                 <Button
                    variant="outline"
                    onClick={handleMarkAllAsPaid}
                    disabled={expensesToSettle.length === 0}
                >
                    Mark All Expenses as Paid
                </Button>
            </div>
            <div>
                 <Button
                    onClick={handleMarkSelectedAsPaid}
                    disabled={selectedExpenseIds.length === 0}
                >
                    Mark Selected as Paid ({selectedExpenseIds.length})
                </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
