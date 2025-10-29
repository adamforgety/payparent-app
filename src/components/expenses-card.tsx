'use client';

import { format, startOfMonth } from 'date-fns';
import { ReceiptText, Trash2, CheckCheck } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Expense, PaymentStatus, ParentNames, ChildSupport } from '@/lib/types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ExportButton } from './export-button';
import { cn } from '@/lib/utils';
import { EditExpenseDialog } from './edit-expense-dialog';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Separator } from './ui/separator';

interface ExpensesCardProps {
  expenses: Expense[];
  childSupport: ChildSupport;
  onDelete: (expenseId: string) => void;
  onUpdateExpense: (expense: Expense) => void;
  onUpdateChildSupport: (childSupport: ChildSupport) => void;
  children: ReactNode;
  currentDate: Date;
  parentNames: ParentNames;
}

export function ExpensesCard({
  expenses,
  childSupport,
  onDelete,
  onUpdateExpense,
  onUpdateChildSupport,
  children,
  currentDate,
  parentNames,
}: ExpensesCardProps) {
  
  const childSupportAsExpense: Expense | null =
    childSupport.amount > 0 && childSupport.paidBy !== 'None'
      ? {
          id: 'child-support',
          date: startOfMonth(currentDate).toISOString(),
          description: 'Child Support',
          amount: childSupport.amount,
          paidBy: childSupport.paidBy,
          status: childSupport.status,
          category: 'Child Support',
        }
      : null;

  const allItems = [...(childSupportAsExpense ? [childSupportAsExpense] : []), ...expenses];

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  const totalPaid = allItems
    .filter(item => item.status === 'Paid')
    .reduce((sum, item) => sum + item.amount, 0);

  const handleStatusChange = (item: Expense, newStatus: PaymentStatus) => {
    if (item.id === 'child-support') {
      onUpdateChildSupport({ ...childSupport, status: newStatus });
    } else {
      onUpdateExpense({ ...item, status: newStatus });
    }
  };

  const handleMarkAllAsPaid = () => {
    expenses.forEach(exp => {
      if (exp.status === 'Unpaid') {
        onUpdateExpense({ ...exp, status: 'Paid' });
      }
    });
    if (childSupportAsExpense && childSupport.status === 'Unpaid') {
      onUpdateChildSupport({ ...childSupport, status: 'Paid' });
    }
  };
  
  const hasUnpaidItems = allItems.some(item => item.status === 'Unpaid');


  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <ReceiptText className="h-5 w-5 text-secondary-foreground" />
            </span>
            <div>
              <CardTitle>Transactions</CardTitle>
              <CardDescription>
                Expenses and child support for the current month.
              </CardDescription>
            </div>
          </div>
          <div className="no-print flex flex-wrap items-center justify-end gap-2">
            <ExportButton expenses={expenses} currentDate={currentDate} />
            <Button variant="outline" onClick={handleMarkAllAsPaid} disabled={!hasUnpaidItems}>
                <CheckCheck className="mr-2 h-4 w-4" />
                Mark All Paid
            </Button>
            {children}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Paid By</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-[120px] no-print text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allItems.length > 0 ? (
              allItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {format(new Date(item.date), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="font-medium">
                    {item.description}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.id === 'child-support' ? 'default' : 'outline'}>{item.category}</Badge>
                  </TableCell>
                  <TableCell>
                    {item.paidBy && <Badge variant={item.paidBy === 'Parent 1' ? 'secondary' : 'outline'}>{parentNames[item.paidBy]}</Badge>}
                  </TableCell>
                  <TableCell>
                     <div className="flex items-center space-x-2">
                        <Switch
                            id={`status-switch-${item.id}`}
                            checked={item.status === 'Paid'}
                            onCheckedChange={(checked) =>
                                handleStatusChange(item, checked ? 'Paid' : 'Unpaid')
                            }
                            aria-label={`Mark as ${item.status === 'Paid' ? 'Unpaid' : 'Paid'}`}
                        />
                        <Label htmlFor={`status-switch-${item.id}`} className={cn(item.status === 'Paid' ? 'text-green-600' : 'text-destructive')}>
                          {item.status}
                        </Label>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    ${item.amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="no-print text-right">
                    <div className="flex justify-end gap-1 h-8">
                      {item.id !== 'child-support' && (
                        <>
                            <EditExpenseDialog expense={item} onUpdateExpense={onUpdateExpense} parentNames={parentNames} />
                            <TooltipProvider>
                                <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => onDelete(item.id)}
                                    >
                                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No transactions logged for this month.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="flex-col items-end gap-4 bg-secondary/50 p-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold">Total Monthly Expenses:</span>
          <span className="text-lg font-bold">
            ${totalExpenses.toFixed(2)}
          </span>
        </div>
        <Separator/>
         <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-green-600">Total Paid:</span>
          <span className="text-lg font-bold text-green-600">
            ${totalPaid.toFixed(2)}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}
