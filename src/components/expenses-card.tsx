'use client';

import { format } from 'date-fns';
import { ReceiptText, Trash2 } from 'lucide-react';
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
import type { Expense } from '@/lib/types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ExportButton } from './export-button';
import { cn } from '@/lib/utils';

interface ExpensesCardProps {
  expenses: Expense[];
  onDelete: (expenseId: string) => void;
  children: ReactNode;
  currentDate: Date;
}

export function ExpensesCard({
  expenses,
  onDelete,
  children,
  currentDate,
}: ExpensesCardProps) {
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <ReceiptText className="h-5 w-5 text-secondary-foreground" />
            </span>
            <div>
              <CardTitle>Expenses</CardTitle>
              <CardDescription>
                Logged expenses for the current month.
              </CardDescription>
            </div>
          </div>
          <div className="no-print flex items-center gap-2 self-end sm:self-auto">
            <ExportButton expenses={expenses} currentDate={currentDate} />
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
              <TableHead className="w-[50px] no-print"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length > 0 ? (
              expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>
                    {format(new Date(expense.date), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="font-medium">
                    {expense.description}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{expense.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={expense.paidBy === 'Parent 1' ? 'secondary' : 'outline'}>{expense.paidBy}</Badge>
                  </TableCell>
                  <TableCell>
                     <Badge
                        variant={expense.status === 'Paid' ? 'default' : 'destructive'}
                        className={cn(expense.status === 'Paid' && 'bg-green-600 hover:bg-green-700')}
                    >
                        {expense.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    ${expense.amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="no-print">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onDelete(expense.id)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No expenses logged for this month.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="justify-end bg-secondary/50 p-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold">Total Expenses:</span>
          <span className="text-lg font-bold">
            ${totalExpenses.toFixed(2)}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}
