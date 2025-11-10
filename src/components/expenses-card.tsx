

'use client';

import { format, startOfMonth, isAfter, isBefore, startOfDay, parse } from 'date-fns';
import { ReceiptText, Trash2, MoreVertical, Paperclip, Search, ArrowUpDown, Edit, CheckCircle, CircleDot, Sheet, Plus, Banknote } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState, useMemo, useEffect } from 'react';


import {
  Card,
  CardContent,
  CardDescription,
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
  TableFooter,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Expense, PaymentStatus, ParentNames, ChildSupport, ExpenseSplit, Parent, MedicalExpenseSplit, AppData } from '@/lib/types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { EditExpenseDialog } from './edit-expense-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Input } from './ui/input';
import { Separator } from './ui/separator';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { useAppContext } from '@/context/app-context';
import { ExportButton } from './export-button';

interface ExpensesCardProps {
  expenses: Expense[];
  childSupport: ChildSupport;
  expenseSplit: ExpenseSplit;
  medicalExpenseSplit: MedicalExpenseSplit;
  onDelete: (expenseId: string) => void;
  onUpdateExpense: (expense: Expense, originalMonthId: string) => void;
  onUpdateChildSupport: (childSupport: ChildSupport, monthId: string) => void;
  children: ReactNode;
  currentDate: Date;
  parentNames: ParentNames;
  appData: AppData;
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

type SortKey = 'date' | 'description' | 'category' | 'paidBy' | 'status' | 'amount';

type SortConfig = {
  key: SortKey;
  direction: 'ascending' | 'descending';
} | null;

export function ExpensesCard({
  expenses,
  childSupport,
  expenseSplit,
  medicalExpenseSplit,
  onDelete,
  onUpdateExpense,
  onUpdateChildSupport,
  children,
  currentDate,
  parentNames,
  appData,
}: ExpensesCardProps) {
  const { batchUpdateMonths } = useAppContext();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [localItems, setLocalItems] = useState<DisplayItem[]>([]);
  const { toast } = useToast();
  const monthId = format(currentDate, 'yyyy-MM');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'descending' });

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
      allItems.unshift(childSupportItem);
    }
    // Sort by date after combining
    allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setLocalItems(allItems);
  }, [expenses, childSupport, currentDate]);

  const getParentShare = (item: DisplayItem, parent: Parent): number => {
    if (item.type === 'child_support') {
        return item.paidBy === parent ? item.amount : 0;
    }

    const expense = item as Expense;
    if (expense.category === 'Reimbursement' || expense.category === 'Credit') {
        return expense.paidBy === parent ? 0 : expense.amount;
    }

    const split = expense.category === 'Medical' || expense.category === 'Child Care'
        ? medicalExpenseSplit
        : expenseSplit;

    return expense.amount * (split[parent] / 100);
};

  const filteredAndSortedItems = useMemo(() => {
    let items = [...localItems];

    // Status filter
    if (statusFilter !== 'all') {
      const filterStatus: PaymentStatus = statusFilter === 'settled' ? 'Settled' : 'Unsettled';
      items = items.filter(item => item.status === filterStatus);
    }
    
    // Search filter
    const lowercasedFilter = searchTerm.toLowerCase();
    if (lowercasedFilter) {
        items = items.filter(item => {
            const paidByName = item.paidBy && item.paidBy !== 'None' ? parentNames[item.paidBy].toLowerCase() : '';
            return item.description.toLowerCase().includes(lowercasedFilter) ||
                   item.category.toLowerCase().includes(lowercasedFilter) ||
                   paidByName.includes(lowercasedFilter);
        });
    }

    // Sorting
    if (sortConfig !== null) {
      items.sort((a, b) => {
        let aValue: string | number;
        let bValue: string | number;

        if (sortConfig.key === 'paidBy') {
            aValue = a.paidBy === 'None' ? '' : parentNames[a.paidBy];
            bValue = b.paidBy === 'None' ? '' : parentNames[b.paidBy];
        } else {
             aValue = a[sortConfig.key as keyof DisplayItem];
             bValue = b[sortConfig.key as keyof DisplayItem];
        }

        if (sortConfig.key === 'date') {
          const dateA = new Date(aValue).getTime();
          const dateB = new Date(bValue).getTime();
          if (dateA < dateB) return sortConfig.direction === 'ascending' ? -1 : 1;
          if (dateA > dateB) return sortConfig.direction === 'ascending' ? 1 : -1;
          return 0;
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
            if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        }
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
            return sortConfig.direction === 'ascending'
                ? aValue.localeCompare(bValue)
                : bValue.localeCompare(aValue);
        }

        return 0;
      });
    }


    return items;
  }, [localItems, statusFilter, searchTerm, sortConfig, parentNames]);

  const totals = useMemo(() => {
    return filteredAndSortedItems.reduce(
      (acc, item) => {
        if (item.category !== 'Reimbursement' && item.category !== 'Credit') {
          acc.totalInitialAmount += item.amount;
        }
        
        let p1Share = getParentShare(item, 'Parent 1');
        let p2Share = getParentShare(item, 'Parent 2');

        if (item.category === 'Reimbursement' || item.category === 'Credit') {
          if (item.paidBy === 'Parent 1') {
            // Parent 1 paid, so they get a credit. Their "share" is negative.
            p1Share -= item.amount;
          } else if (item.paidBy === 'Parent 2') {
            // Parent 2 paid, so they get a credit.
            p2Share -= item.amount;
          }
        }
        
        acc.totalP1Share += p1Share;
        acc.totalP2Share += p2Share;
        
        return acc;
      },
      { totalInitialAmount: 0, totalP1Share: 0, totalP2Share: 0 }
    );
  }, [filteredAndSortedItems, expenseSplit, medicalExpenseSplit]);
  
  const allItemsSettled = useMemo(() => {
    if (localItems.length === 0) return false; // No items, switch should be off.
    return localItems.every(item => item.status === 'Settled');
  }, [localItems]);

  const handleAllStatusToggle = (checked: boolean) => {
    const newStatus: PaymentStatus = checked ? 'Settled' : 'Unsettled';
    let madeChanges = false;
    
    const updatedLocalItems = localItems.map(item => {
      if (item.status !== newStatus) {
        madeChanges = true;
        return { ...item, status: newStatus };
      }
      return item;
    });

    if (madeChanges) {
      setLocalItems(updatedLocalItems);
      
      const newExpenses = expenses.map(e => ({ ...e, status: newStatus }));
      const newChildSupport = { ...childSupport, status: newStatus };
      
      batchUpdateMonths({
        [monthId]: {
          expenses: newExpenses,
          childSupport: newChildSupport,
        },
      });

      toast({
        title: `All Items Marked as ${newStatus}`,
        description: `All items for this month are now ${newStatus.toLowerCase()}.`,
      });
    }
  };

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
    } else if (itemToToggle.type === 'child_support') {
        onUpdateChildSupport({ ...childSupport, status: newStatus }, monthId);
    }

     toast({
      title: `Item Marked as ${newStatus}`,
      description: `"${itemToToggle.description}" has been updated.`,
    });
  };

  const requestSort = (key: SortKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const SortableHeader = ({ sortKey, children, className }: { sortKey: SortKey, children: React.ReactNode, className?: string }) => (
    <TableHead className={className}>
      <Button variant="ghost" onClick={() => requestSort(sortKey)} className="px-2 py-1 h-auto -ml-2">
        {children}
        {sortConfig?.key === sortKey ? (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼') : <ArrowUpDown className="ml-2 h-3 w-3" />}
      </Button>
    </TableHead>
  );

  const settledCount = localItems.filter(item => item.status === 'Settled').length;
  const totalCount = localItems.length;

  return (
    <Card>
      <CardHeader className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
            <ReceiptText className="h-5 w-5 text-secondary-foreground" />
            </span>
            <div>
            <CardTitle>Monthly Ledger</CardTitle>
            <CardDescription>
                All expenses and child support for {format(currentDate, 'MMMM yyyy')}.
            </CardDescription>
            </div>
        </div>
        <div className="no-print flex w-full flex-wrap items-center justify-end gap-2">
            {children}
            <div className="flex items-center space-x-2">
                <Label htmlFor="settle-all-switch" className="text-sm">Settle All</Label>
                <Switch
                    id="settle-all-switch"
                    checked={allItemsSettled}
                    onCheckedChange={handleAllStatusToggle}
                    disabled={localItems.length === 0}
                />
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="no-print flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
          <div className="relative flex-grow">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 justify-end flex-wrap">
            <Button variant={statusFilter === 'all' ? 'secondary' : 'outline'} size="sm" onClick={() => setStatusFilter('all')}>All ({localItems.length})</Button>
            <Button variant={statusFilter === 'unsettled' ? 'secondary' : 'outline'} size="sm" onClick={() => setStatusFilter('unsettled')}>Unsettled ({localItems.filter(i => i.status === 'Unsettled').length})</Button>
            <Button variant={statusFilter === 'settled' ? 'secondary' : 'outline'} size="sm" onClick={() => setStatusFilter('settled')}>Settled ({localItems.filter(i => i.status === 'Settled').length})</Button>
          </div>
        </div>
        {/* Desktop Table View */}
          <div className="overflow-x-auto hidden md:block rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader sortKey="description">Description</SortableHeader>
                  <SortableHeader sortKey="category" className="w-[140px]">Category</SortableHeader>
                  <SortableHeader sortKey="paidBy" className="w-[140px]">Initial Payer</SortableHeader>
                  <SortableHeader sortKey="status" className="w-[160px]">Status</SortableHeader>
                  <SortableHeader sortKey="amount" className="text-right w-[120px]">Initial Amount</SortableHeader>
                  <TableHead className="text-right w-[120px]">{parentNames['Parent 1']}'s Share</TableHead>
                  <TableHead className="text-right w-[120px]">{parentNames['Parent 2']}'s Share</TableHead>
                  <TableHead className="w-[50px] no-print text-center">Receipt</TableHead>
                  <TableHead className="w-[80px] no-print text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedItems.length > 0 ? (
                  filteredAndSortedItems.map((item) => {
                    const p1Share = getParentShare(item, 'Parent 1');
                    const p2Share = getParentShare(item, 'Parent 2');
                    const isP1Reimbursed = (item.category === 'Reimbursement' || item.category === 'Credit') && item.paidBy === 'Parent 1';
                    const isP2Reimbursed = (item.category === 'Reimbursement' || item.category === 'Credit') && item.paidBy === 'Parent 2';

                    let p1Color, p2Color;

                    if (item.type === 'child_support') {
                        if (item.paidBy === 'Parent 1') { // Parent 1 is paying
                            p1Color = item.status === 'Unsettled' ? 'text-destructive' : 'text-green-600';
                            p2Color = 'text-green-600';
                        } else { // Parent 2 is paying
                            p1Color = 'text-green-600';
                            p2Color = item.status === 'Unsettled' ? 'text-destructive' : 'text-green-600';
                        }
                    } else {
                        // Regular Expense Logic
                        p1Color = item.paidBy === 'Parent 1' ? 'text-green-600' : (item.status === 'Settled' ? 'text-green-600' : 'text-destructive');
                        p2Color = item.paidBy === 'Parent 2' ? 'text-green-600' : (item.status === 'Settled' ? 'text-green-600' : 'text-destructive');
                    }


                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.description}
                          <div className="text-xs text-muted-foreground">{format(new Date(item.date), 'MMM d, yyyy')}</div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={item.category === 'Child Support' ? 'default' : (item.category === 'Reimbursement' || item.category === 'Credit') ? 'outline' : 'secondary'}
                            className={cn((item.category === 'Reimbursement' || item.category === 'Credit') && 'border-primary bg-background text-primary')}
                          >
                            {item.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.paidBy && item.paidBy !== 'None' && <Badge variant={item.paidBy === 'Parent 1' ? 'secondary' : 'outline'}>{parentNames[item.paidBy]}</Badge>}
                        </TableCell>
                        <TableCell>
                           <div className="flex items-center space-x-2">
                            <Switch
                              id={`status-switch-${item.id}`}
                              checked={item.status === 'Settled'}
                              onCheckedChange={() => handleStatusToggle(item)}
                            />
                            <Label htmlFor={`status-switch-${item.id}`} className={cn('w-16', item.status === 'Settled' ? 'text-green-600' : 'text-destructive')}>
                              {item.status}
                            </Label>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          ${item.amount.toFixed(2)}
                        </TableCell>
                         <TableCell className={cn("text-right", p1Color)}>
                           {isP1Reimbursed ? `($${item.amount.toFixed(2)})` : `$${p1Share.toFixed(2)}`}
                        </TableCell>
                        <TableCell className={cn("text-right", p2Color)}>
                            {isP2Reimbursed ? `($${item.amount.toFixed(2)})` : `$${p2Share.toFixed(2)}`}
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
                                <EditExpenseDialog
                                  expense={item as Expense}
                                  onUpdateExpense={(exp) => onUpdateExpense(exp, monthId)}
                                  parentNames={parentNames}
                                  monthId={monthId}
                                />
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
                      {searchTerm ? `No results for "${searchTerm}".` : `No ${statusFilter !== 'all' ? statusFilter : ''} transactions logged for this month.`}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              {filteredAndSortedItems.length > 0 && (
                <TableFooter>
                  <TableRow className="bg-secondary/50 font-bold">
                    <TableCell colSpan={3}>Totals</TableCell>
                    <TableCell>
                      {totalCount > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {settledCount} of {totalCount} settled
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                        ${totals.totalInitialAmount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      ${totals.totalP1Share.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                       ${totals.totalP2Share.toFixed(2)}
                    </TableCell>
                    <TableCell colSpan={2}></TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>

          {/* Mobile Card View */}
        <div className="space-y-4 md:hidden">
            {filteredAndSortedItems.length > 0 && (
                <Card className="bg-secondary/50">
                    <CardHeader>
                        <CardTitle className="text-lg">Totals for {format(currentDate, 'MMMM yyyy')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                            <span className="font-medium">{parentNames['Parent 1']}'s Share</span>
                            <span className="font-semibold">${totals.totalP1Share.toFixed(2)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                            <span className="font-medium">{parentNames['Parent 2']}'s Share</span>
                            <span className="font-semibold">${totals.totalP2Share.toFixed(2)}</span>
                        </div>
                    </CardContent>
                </Card>
             )}
            {filteredAndSortedItems.length > 0 ? (
                filteredAndSortedItems.map((item) => {
                    const p1Share = getParentShare(item, 'Parent 1');
                    const p2Share = getParentShare(item, 'Parent 2');
                    const isP1Reimbursed = (item.category === 'Reimbursement' || item.category === 'Credit') && item.paidBy === 'Parent 1';
                    const isP2Reimbursed = (item.category === 'Reimbursement' || item.category === 'Credit') && item.paidBy === 'Parent 2';

                    let p1Color, p2Color;

                    if (item.type === 'child_support') {
                        if (item.paidBy === 'Parent 1') { // Parent 1 is paying
                            p1Color = item.status === 'Unsettled' ? 'text-destructive' : 'text-green-600';
                            p2Color = 'text-green-600';
                        } else { // Parent 2 is paying
                            p1Color = 'text-green-600';
                            p2Color = item.status === 'Unsettled' ? 'text-destructive' : 'text-green-600';
                        }
                    } else {
                        // Regular Expense Logic
                        p1Color = item.paidBy === 'Parent 1' ? 'text-green-600' : (item.status === 'Settled' ? 'text-green-600' : 'text-destructive');
                        p2Color = item.paidBy === 'Parent 2' ? 'text-green-600' : (item.status === 'Settled' ? 'text-green-600' : 'text-destructive');
                    }


                    return (
                        <Card key={item.id} className="overflow-hidden">
                            <div className="p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold">{item.description}</p>
                                        <p className="text-sm text-muted-foreground">{format(new Date(item.date), 'MMM d, yyyy')}</p>
                                    </div>
                                    <div className="flex items-center gap-1 -mr-2">
                                        {item.type === 'expense' && item.receiptUrl && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                                        <a href={item.receiptUrl} target="_blank" rel="noopener noreferrer">
                                                            <Paperclip className="h-4 w-4 text-muted-foreground" />
                                                        </a>
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>View Receipt</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                        {item.type === 'expense' && (
                                            <>
                                            <EditExpenseDialog
                                                expense={item as Expense}
                                                onUpdateExpense={(exp) => onUpdateExpense(exp, monthId)}
                                                parentNames={parentNames}
                                                monthId={monthId}
                                            />
                                            <TooltipProvider>
                                                <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(item.id)}>
                                                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Delete</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <Badge
                                      variant={item.category === 'Child Support' ? 'default' : (item.category === 'Reimbursement' || item.category === 'Credit') ? 'outline' : 'secondary'}
                                      className={cn((item.category === 'Reimbursement' || item.category === 'Credit') && 'border-primary bg-background text-primary')}
                                    >
                                      {item.category}
                                    </Badge>
                                    <p className="font-bold text-lg">${item.amount.toFixed(2)}</p>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Initial Payer</span>
                                    {item.paidBy && item.paidBy !== 'None' && <Badge variant={item.paidBy === 'Parent 1' ? 'secondary' : 'outline'}>{parentNames[item.paidBy]}</Badge>}
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                     <span className="text-muted-foreground">Status</span>
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                        id={`status-switch-mobile-${item.id}`}
                                        checked={item.status === 'Settled'}
                                        onCheckedChange={() => handleStatusToggle(item)}
                                        />
                                        <Label htmlFor={`status-switch-mobile-${item.id}`} className={cn('w-16', item.status === 'Settled' ? 'text-green-600' : 'text-destructive')}>{item.status}</Label>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-muted/50 px-4 py-3 text-sm space-y-2">
                                <p className="font-medium text-xs text-muted-foreground">Share Details</p>
                                <div className="flex justify-between">
                                <span className="text-muted-foreground">{parentNames['Parent 1']}'s Share</span>
                                <span className={cn("font-semibold", p1Color)}>
                                    {isP1Reimbursed ? `($${item.amount.toFixed(2)})` : `$${p1Share.toFixed(2)}`}
                                </span>
                                </div>
                                <div className="flex justify-between">
                                <span className="text-muted-foreground">{parentNames['Parent 2']}'s Share</span>
                                <span className={cn("font-semibold", p2Color)}>
                                    {isP2Reimbursed ? `($${item.amount.toFixed(2)})` : `$${p2Share.toFixed(2)}`}
                                </span>
                                </div>
                            </div>
                        </Card>
                    );
                })
            ) : (
                <div className="h-32 text-center flex flex-col justify-center items-center">
                    <p className="text-muted-foreground">
                        {searchTerm ? `No results for "${searchTerm}".` : `No ${statusFilter !== 'all' ? statusFilter : ''} transactions logged for this month.`}
                    </p>
                </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}

type StatusFilter = 'all' | 'settled' | 'unsettled';

    

