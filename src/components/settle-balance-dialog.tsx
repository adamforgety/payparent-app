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
  onUpdateChildSupport: (childSupport: ChildSupport) => void;
  children: React.ReactNode;
}

export function SettleBalanceDialog({
  parent,
  otherParent,
  expenses,
  expenseSplit,
  childSupport,
  onUpdateExpense,
  onUpdateChildSupport,
  children,
}: SettleBalanceDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const otherParentSplit = expenseSplit[otherParent];

  const expensesToSettle = useMemo(() => {
    // These are expenses paid by `parent` that `otherParent` has not paid their share for.
    return expenses.filter(
      (exp) => exp.paidBy === parent && exp.status === 'Unpaid'
    );
  }, [expenses, parent]);

  const childSupportToSettle = useMemo(() => {
    // Child support is owed to `parent` if `otherParent` is the payer and it's unpaid.
    return childSupport.paidBy === otherParent && childSupport.status === 'Unpaid'
      ? { ...childSupport, id: 'child-support' }
      : null;
  }, [childSupport, otherParent]);

  const totalOwedFromExpenses = expensesToSettle.reduce((acc, exp) => {
    const amountOwed = exp.amount * (otherParentSplit / 100);
    return acc + amountOwed;
  }, 0);

  const totalOwedFromChildSupport = childSupportToSettle ? childSupportToSettle.amount : 0;

  const totalOwed = totalOwedFromExpenses + totalOwedFromChildSupport;

  const handleToggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((selectedId) => selectedId !== id)
        : [...prev, id]
    );
  };
  
  const handleMarkAllAsPaid = () => {
    expensesToSettle.forEach((exp) => {
      onUpdateExpense({ ...exp, status: 'Paid' });
    });
    if (childSupportToSettle) {
        onUpdateChildSupport({ ...childSupport, status: 'Paid' });
    }
    setSelectedIds([]);
    setIsOpen(false);
  };


  const handleMarkSelectedAsPaid = () => {
    selectedIds.forEach((id) => {
        if (id === 'child-support') {
            onUpdateChildSupport({ ...childSupport, status: 'Paid' });
        } else {
            const expense = expenses.find(exp => exp.id === id);
            if (expense) {
                onUpdateExpense({ ...expense, status: 'Paid' });
            }
        }
    });
    setSelectedIds([]);
    setIsOpen(false);
  };
  
  const allItemsToSettle = expensesToSettle.length + (childSupportToSettle ? 1 : 0);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Settle Balance with {otherParent}</DialogTitle>
          <DialogDescription>
            These are the amounts {otherParent} owes you for this month. Mark items as paid once you've received the funds.
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
              {childSupportToSettle && (
                <TableRow>
                    <TableCell>
                         <Checkbox
                          id="select-child-support"
                          checked={selectedIds.includes('child-support')}
                          onCheckedChange={() =>
                            handleToggleSelection('child-support')
                          }
                        />
                    </TableCell>
                    <TableCell>Child Support</TableCell>
                    <TableCell className="text-right">${childSupportToSettle.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">${childSupportToSettle.amount.toFixed(2)}</TableCell>
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
                          checked={selectedIds.includes(expense.id)}
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
                !childSupportToSettle && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      No unpaid items to settle.
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
                    disabled={allItemsToSettle === 0}
                >
                    Mark All as Paid
                </Button>
            </div>
            <div>
                 <Button
                    onClick={handleMarkSelectedAsPaid}
                    disabled={selectedIds.length === 0}
                >
                    Mark Selected as Paid ({selectedIds.length})
                </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
