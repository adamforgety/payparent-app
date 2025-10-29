'use client';

import { format, startOfMonth } from 'date-fns';
import { ReceiptText, Trash2, CheckCheck, MoreVertical } from 'lucide-react';
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
import type { Expense, PaymentStatus, ParentNames, ChildSupport, ExpenseSplit, Parent } from '@/lib/types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ExportButton } from './export-button';
import { cn } from '@/lib/utils';
import { EditExpenseDialog } from './edit-expense-dialog';
import { Separator } from './ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';

interface ExpensesCardProps {
  expenses: Expense[];
  childSupport: ChildSupport;
  expenseSplit: ExpenseSplit;
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
  expenseSplit,
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
  
  const hasUnpaidItems = allItems.some(item => item.status === 'Unpaid');

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

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

  const parent1ExpenseShare = totalExpenses * (expenseSplit['Parent 1'] / 100);
  const parent1TotalShare = parent1ExpenseShare + (childSupport.paidBy === 'Parent 1' || childSupport.paidBy === 'None' ? childSupport.amount : 0);
  const parent2ExpenseShare = totalExpenses * (expenseSplit['Parent 2'] / 100);
  const parent2TotalShare = parent2ExpenseShare + (childSupport.paidBy === 'Parent 2' ? childSupport.amount : 0);


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
          <div className="no-print flex flex-wrap items-center justify-start sm:justify-end gap-2">
            {children}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">More actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleMarkAllAsPaid} disabled={!hasUnpaidItems}>
                  <CheckCheck className="mr-2 h-4 w-4" />
                  Mark All Paid
                </DropdownMenuItem>
                 <ExportButton
                  expenses={expenses}
                  childSupport={childSupport}
                  currentDate={currentDate}
                  parentNames={parentNames}
                  asChild
                />
              </DropdownMenuContent>
            </DropdownMenu>
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
              <TableHead className="w-[100px]">Status</TableHead>
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
                     <Badge variant={item.status === 'Paid' ? 'secondary' : 'destructive'} className='w-[55px] justify-center'>
                        {item.status}
                      </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    ${item.amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="no-print text-right">
                    <div className="flex justify-end gap-1 h-8 w-full">
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
       <CardFooter className="flex-col items-stretch gap-4 bg-secondary/50 p-4 text-sm">
         <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Expense Total:</span>
          <span className="font-medium">
            ${totalExpenses.toFixed(2)}
          </span>
        </div>
        {childSupport.amount > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Child Support:</span>
            <span className="font-medium">
              ${childSupport.amount.toFixed(2)}
            </span>
          </div>
        )}
        <Separator/>
        <div className="flex justify-between items-center">
          <span className="font-semibold text-primary">{parentNames['Parent 1']}'s Total Share:</span>
          <span className="font-bold text-base text-primary">
            ${parent1TotalShare.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-semibold text-primary">{parentNames['Parent 2']}'s Total Share:</span>
          <span className="font-bold text-base text-primary">
            ${parent2TotalShare.toFixed(2)}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}
