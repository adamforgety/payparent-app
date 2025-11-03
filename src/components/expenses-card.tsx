'use client';

import { format, startOfMonth, isAfter } from 'date-fns';
import { ReceiptText, Trash2, MoreVertical, Paperclip } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState, useMemo, useEffect } from 'react';


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
import type { Expense, PaymentStatus, ParentNames, ChildSupport, ExpenseSplit, Parent, MedicalExpenseSplit } from '@/lib/types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ExportButton } from './export-button';
import { EditExpenseDialog } from './edit-expense-dialog';
import { Separator } from './ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from './ui/dropdown-menu';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ExpensesCardProps {
  expenses: Expense[];
  childSupport: ChildSupport;
  expenseSplit: ExpenseSplit;
  medicalExpenseSplit: MedicalExpenseSplit;
  onDelete: (expenseId: string) => void;
  onUpdateExpense: (expense: Expense, originalMonthId: string) => void;
  onUpdateChildSupport: (childSupport: ChildSupport) => void;
  onMarkAllAsSettled: () => void;
  onMarkAllAsUnsettled: () => void;
  children: ReactNode;
  currentDate: Date;
  parentNames: ParentNames;
}

type DisplayItem = {
    id: string;
    date: string;
    description: string;
    amount: number;
    paidBy: Parent | 'None';
    status: PaymentStatus;
    category: 'Child Support' | Expense['category'];
    type: 'expense' | 'child_support';
    receiptUrl?: string | null;
    receiptFilename?: string | null;
};


export function ExpensesCard({
  expenses,
  childSupport,
  expenseSplit,
  medicalExpenseSplit,
  onDelete,
  onUpdateExpense,
  onUpdateChildSupport,
  onMarkAllAsSettled,
  onMarkAllAsUnsettled,
  children,
  currentDate,
  parentNames,
}: ExpensesCardProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [localItems, setLocalItems] = useState<DisplayItem[]>([]);
  const { toast } = useToast();
  const monthId = format(currentDate, 'yyyy-MM');

  useEffect(() => {
    const expenseItems: DisplayItem[] = expenses.map(e => ({ ...e, type: 'expense' }));
    const isFutureMonth = isAfter(startOfMonth(currentDate), startOfMonth(new Date()));

    let allItems: DisplayItem[] = [...expenseItems];
    if (childSupport.amount > 0 && childSupport.paidBy !== 'None' && !isFutureMonth) {
      const childSupportItem: DisplayItem = {
        id: 'child-support',
        date: startOfMonth(currentDate).toISOString(),
        description: 'Child Support',
        amount: childSupport.amount,
        paidBy: childSupport.paidBy,
        status: childSupport.status,
        category: 'Child Support',
        type: 'child_support',
      };
      allItems.unshift(childSupportItem); // Add to the beginning
    }
    // Sort by date after combining
    allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setLocalItems(allItems);
  }, [expenses, childSupport, currentDate]);


  const filteredItems = useMemo(() => {
    if (statusFilter === 'all') {
      return localItems;
    }
    const filterStatus: PaymentStatus = statusFilter === 'settled' ? 'Settled' : 'Unsettled';
    return localItems.filter(item => item.status === filterStatus);
  }, [localItems, statusFilter]);
  
  const hasUnsettledItems = localItems.some(item => item.status === 'Unsettled');
  const hasSettledItems = localItems.some(item => item.status === 'Settled');

  const { parent1TotalOwes, parent2TotalOwes, parent1TotalPaid, parent2TotalPaid } = useMemo(() => {
    let p1Owes = 0;
    let p2Owes = 0;
    let p1Paid = 0;
    let p2Paid = 0;

    filteredItems.forEach(item => {
        let p1Share = 0;
        let p2Share = 0;

        if (item.type === 'expense') {
            const expense = item as Expense;
            if (expense.category === 'Reimbursement') {
                if (expense.paidBy === 'Parent 1') {
                    p2Share = expense.amount;
                } else {
                    p1Share = expense.amount;
                }
            } else if (expense.category === 'Medical' || expense.category === 'Child Care') {
                p1Share = item.amount * (medicalExpenseSplit['Parent 1'] / 100);
                p2Share = item.amount * (medicalExpenseSplit['Parent 2'] / 100);
            } else {
                p1Share = item.amount * (expenseSplit['Parent 1'] / 100);
                p2Share = item.amount * (expenseSplit['Parent 2'] / 100);
            }
        } else if (item.type === 'child_support') {
            if (item.paidBy === 'Parent 1') { 
                p1Share = item.amount;
            } else { 
                p2Share = item.amount;
            }
        }

        if (item.status === 'Unsettled') {
            const p1InitialPaid = item.paidBy === 'Parent 1' ? item.amount : 0;
            const p2InitialPaid = item.paidBy === 'Parent 2' ? item.amount : 0;
            const p1Net = p1Share - p1InitialPaid;
            const p2Net = p2Share - p2InitialPaid;
            if (p1Net > 0) p1Owes += p1Net;
            if (p2Net > 0) p2Owes += p2Net;
            p1Paid += p1InitialPaid;
            p2Paid += p2InitialPaid;
        } else { // 'Settled'
            p1Paid += p1Share;
            p2Paid += p2Share;
        }
    });

    return { parent1TotalOwes: p1Owes, parent2TotalOwes: p2Owes, parent1TotalPaid: p1Paid, parent2TotalPaid: p2Paid };
  }, [filteredItems, expenseSplit, medicalExpenseSplit]);

  const totalExpenses = filteredItems
    .filter(item => item.type === 'expense')
    .reduce((sum, exp) => sum + exp.amount, 0);

  const handleStatusToggle = (itemToToggle: DisplayItem) => {
    const newStatus: PaymentStatus = itemToToggle.status === 'Settled' ? 'Unsettled' : 'Settled';
    
    // Update local state immediately for instant UI feedback
    setLocalItems(prevItems => 
      prevItems.map(item => 
        item.id === itemToToggle.id ? { ...item, status: newStatus } : item
      )
    );
    
    // Propagate change to parent for persistence
    if (itemToToggle.type === 'expense') {
        const originalExpense = expenses.find(e => e.id === itemToToggle.id);
        if (originalExpense) {
            onUpdateExpense({ ...originalExpense, status: newStatus }, monthId);
        }
    } else { // Child Support
        onUpdateChildSupport({ ...childSupport, status: newStatus });
    }

     toast({
      title: `Item Marked as ${newStatus}`,
      description: `"${itemToToggle.description}" has been updated.`,
    });
  };


  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <ReceiptText className="h-5 w-5 text-secondary-foreground" />
            </span>
            <div>
              <CardTitle>Monthly Ledger</CardTitle>
              <CardDescription>
                All expenses and child support for {format(currentDate, 'MMMM yyyy')}.
              </CardDescription>
            </div>
          </div>
          <div className="no-print flex items-center justify-start sm:justify-end gap-2">
            {children}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">More actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onMarkAllAsSettled} disabled={!hasUnsettledItems}>
                  Mark All Settled
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onMarkAllAsUnsettled} disabled={!hasSettledItems}>
                  Mark All Unsettled
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                 <ExportButton
                  expenses={expenses}
                  childSupport={childSupport}
                  currentDate={currentDate}
                  parentNames={parentNames}
                  expenseSplit={expenseSplit}
                  medicalExpenseSplit={medicalExpenseSplit}
                  asChild
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="no-print flex items-center gap-2 mb-4">
          <Button variant={statusFilter === 'all' ? 'secondary' : 'outline'} size="sm" onClick={() => setStatusFilter('all')}>All ({localItems.length})</Button>
          <Button variant={statusFilter === 'unsettled' ? 'secondary' : 'outline'} size="sm" onClick={() => setStatusFilter('unsettled')}>Unsettled ({localItems.filter(i => i.status === 'Unsettled').length})</Button>
          <Button variant={statusFilter === 'settled' ? 'secondary' : 'outline'} size="sm" onClick={() => setStatusFilter('settled')}>Settled ({localItems.filter(i => i.status === 'Settled').length})</Button>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Paid By</TableHead>
                <TableHead className="w-[120px]">Settlement Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">{parentNames['Parent 1']} Owes</TableHead>
                <TableHead className="text-right">{parentNames['Parent 2']} Owes</TableHead>
                <TableHead className="w-[50px] no-print text-center">Receipt</TableHead>
                <TableHead className="w-[80px] no-print text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => {
                  let p1Net = 0;
                  let p2Net = 0;

                  if (item.status === 'Unsettled') {
                    let p1Share = 0;
                    let p2Share = 0;

                    if (item.type === 'expense') {
                        const expense = item as Expense;
                        if (expense.category === 'Reimbursement') {
                            if (expense.paidBy === 'Parent 1') {
                                p2Share = expense.amount;
                            } else {
                                p1Share = expense.amount;
                            }
                        } else if (expense.category === 'Medical' || expense.category === 'Child Care') {
                            p1Share = item.amount * (medicalExpenseSplit['Parent 1'] / 100);
                            p2Share = item.amount * (medicalExpenseSplit['Parent 2'] / 100);
                        } else {
                            p1Share = item.amount * (expenseSplit['Parent 1'] / 100);
                            p2Share = item.amount * (expenseSplit['Parent 2'] / 100);
                        }
                    } else if (item.type === 'child_support') {
                        if (item.paidBy === 'Parent 1') { // Parent 1 paid child support to Parent 2
                            p1Share = item.amount;
                        } else if (item.paidBy === 'Parent 2') { // Parent 2 paid child support to Parent 1
                            p2Share = item.amount;
                        }
                    }

                    const p1Paid = item.paidBy === 'Parent 1' ? item.amount : 0;
                    const p2Paid = item.paidBy === 'Parent 2' ? item.amount : 0;
                    p1Net = p1Share - p1Paid;
                    p2Net = p2Share - p2Paid;
                  }
                  
                  const p1Owes = p1Net > 0 ? p1Net : 0;
                  const p2Owes = p2Net > 0 ? p2Net : 0;
                  const p1Credit = p1Net < 0 ? -p1Net : 0;
                  const p2Credit = p2Net < 0 ? -p2Net : 0;

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.description}
                        <div className="text-xs text-muted-foreground">{format(new Date(item.date), 'MMM d, yyyy')}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.category === 'Child Support' ? 'default' : item.category === 'Reimbursement' ? 'reimbursement' : 'outline'}>{item.category}</Badge>
                      </TableCell>
                      <TableCell>
                        {item.paidBy && item.paidBy !== 'None' && <Badge variant={item.paidBy === 'Parent 1' ? 'secondary' : 'outline'}>{parentNames[item.paidBy]}</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`settle-switch-${item.id}`}
                            checked={item.status === 'Settled'}
                            onCheckedChange={() => handleStatusToggle(item)}
                            aria-label={`Settle payment for ${item.description}`}
                          />
                          <Label htmlFor={`settle-switch-${item.id}`}>
                            {item.status}
                          </Label>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ${item.amount.toFixed(2)}
                      </TableCell>
                       <TableCell className={cn("text-right", item.status === 'Unsettled' && p1Owes > 0 && "text-destructive font-semibold")}>
                        {p1Credit > 0 ? `($${p1Credit.toFixed(2)})` : `$${p1Owes.toFixed(2)}`}
                      </TableCell>
                      <TableCell className={cn("text-right", item.status === 'Unsettled' && p2Owes > 0 && "text-destructive font-semibold")}>
                         {p2Credit > 0 ? `($${p2Credit.toFixed(2)})` : `$${p2Owes.toFixed(2)}`}
                      </TableCell>
                      <TableCell className="no-print text-center">
                          {item.type === 'expense' && item.receiptUrl && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      asChild
                                    >
                                      <a href={item.receiptUrl} target="_blank" rel="noopener noreferrer">
                                          <Paperclip className="h-4 w-4 text-muted-foreground" />
                                      </a>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>View Receipt</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                      </TableCell>
                      <TableCell className="no-print text-right">
                        <div className="flex justify-end gap-1 h-8 w-full">
                          {item.type === 'expense' && (
                            <>
                                <EditExpenseDialog expense={item as Expense} onUpdateExpense={(exp) => onUpdateExpense(exp, monthId)} parentNames={parentNames} monthId={monthId} />
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
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    No {statusFilter !== 'all' ? statusFilter : ''} transactions logged for this month.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
       <CardFooter className="flex-col items-stretch gap-4 bg-secondary/50 p-4 text-sm">
         <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Expense Total:</span>
          <span className="font-medium">
            ${totalExpenses.toFixed(2)}
          </span>
        </div>
        {childSupport.amount > 0 && !isAfter(startOfMonth(currentDate), startOfMonth(new Date())) && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Child Support:</span>
            <span className="font-medium">
              ${childSupport.amount.toFixed(2)}
            </span>
          </div>
        )}
        <Separator/>
        <div className="flex justify-between items-center">
            <span className="text-muted-foreground">{parentNames['Parent 1']} Paid:</span>
            <span className="font-medium">${parent1TotalPaid.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center">
            <span className="text-muted-foreground">{parentNames['Parent 2']} Paid:</span>
            <span className="font-medium">${parent2TotalPaid.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="font-semibold text-primary">{parentNames['Parent 1']} Owes:</span>
          <span className="font-bold text-base text-destructive">
            ${parent1TotalOwes.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-semibold text-primary">{parentNames['Parent 2']} Owes:</span>
          <span className="font-bold text-base text-destructive">
            ${parent2TotalOwes.toFixed(2)}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}

type StatusFilter = 'all' | 'settled' | 'unsettled';

    
