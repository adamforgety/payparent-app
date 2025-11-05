'use client';

import { format, startOfMonth, isAfter, isBefore, startOfDay, parse } from 'date-fns';
import { ReceiptText, Trash2, MoreVertical, Paperclip, Search, ArrowUpDown, Edit, CheckCircle, CircleDot } from 'lucide-react';
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
import { ExportButton } from './export-button';
import { EditExpenseDialog } from './edit-expense-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from './ui/dropdown-menu';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Input } from './ui/input';
import { Separator } from './ui/separator';

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

const calculateShare = (
  expenses: Expense[],
  split: ExpenseSplit,
  medicalSplit: MedicalExpenseSplit,
  p: Parent
): number => {
  let totalShare = 0;
  for (const expense of expenses) {
    if (expense.category === 'Medical' || expense.category === 'Child Care') {
      const medicalParentSplitPercent = medicalSplit[p] / 100;
      totalShare += expense.amount * medicalParentSplitPercent;
    } else {
      const parentSplitPercent = split[p] / 100;
      totalShare += expense.amount * parentSplitPercent;
    }
  }
  return totalShare;
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
  appData,
}: ExpensesCardProps) {
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
      allItems.unshift(childSupportItem); // Add to the beginning
    }
    // Sort by date after combining
    allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setLocalItems(allItems);
  }, [expenses, childSupport, currentDate]);


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
        acc.totalAmount += item.amount;

        let p1Paid = 0, p2Paid = 0, p1Owes = 0, p2Owes = 0, p1Credit = 0, p2Credit = 0;

        if (item.type === 'child_support') {
          if (item.status === 'Settled') {
            if (item.paidBy === 'Parent 1') p1Paid = item.amount;
            if (item.paidBy === 'Parent 2') p2Paid = item.amount;
          } else {
            if (item.paidBy === 'Parent 1') p1Owes = item.amount;
            if (item.paidBy === 'Parent 2') p2Owes = item.amount;
          }
        } else {
          const expense = item as Expense;
          const split = expense.category === 'Medical' || expense.category === 'Child Care' ? medicalExpenseSplit : expenseSplit;
          const p1Share = item.amount * (split['Parent 1'] / 100);
          const p2Share = item.amount * (split['Parent 2'] / 100);

          if (item.status === 'Settled') {
            p1Paid = p1Share;
            p2Paid = p2Share;
          } else { // Unsettled
            const p1InitialPaid = expense.paidBy === 'Parent 1' ? expense.amount : 0;
            const p2InitialPaid = expense.paidBy === 'Parent 2' ? expense.amount : 0;
            p1Paid = p1InitialPaid;
            p2Paid = p2InitialPaid;

            const p1Net = p1Share - p1InitialPaid;
            const p2Net = p2Share - p2InitialPaid;

            if (p1Net > 0) p1Owes = p1Net; else p1Credit = -p1Net;
            if (p2Net > 0) p2Owes = p2Net; else p2Credit = -p2Net;
          }
        }

        acc.totalP1Paid += p1Paid;
        acc.totalP2Paid += p2Paid;
        acc.totalP1Owes += p1Owes;
        acc.totalP2Owes += p2Owes;
        acc.totalP1Credit += p1Credit;
        acc.totalP2Credit += p2Credit;
        
        return acc;
      },
      { totalAmount: 0, totalP1Paid: 0, totalP2Paid: 0, totalP1Owes: 0, totalP2Owes: 0, totalP1Credit: 0, totalP2Credit: 0 }
    );
  }, [filteredAndSortedItems, expenseSplit, medicalExpenseSplit]);

  
  const hasUnsettledItems = localItems.some(item => item.status === 'Unsettled');
  const hasSettledItems = localItems.some(item => item.status === 'Settled');

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
        {sortConfig?.key === sortKey ? (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼') : <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />}
      </Button>
    </TableHead>
  );

  const renderItemDetails = (item: DisplayItem) => {
        let p1Paid = 0;
        let p2Paid = 0;
        let p1Owes = 0;
        let p2Owes = 0;
        let p1Credit = 0;
        let p2Credit = 0;

        if (item.type === 'child_support') {
            if (item.status === 'Settled') {
                if (item.paidBy === 'Parent 1') p1Paid = item.amount;
                if (item.paidBy === 'Parent 2') p2Paid = item.amount;
            } else {
                if (item.paidBy === 'Parent 1') p1Owes = item.amount;
                if (item.paidBy === 'Parent 2') p2Owes = item.amount;
            }
        } else {
            const expense = item as Expense;
            const split = expense.category === 'Medical' || expense.category === 'Child Care' ? medicalExpenseSplit : expenseSplit;
            const p1Share = item.amount * (split['Parent 1'] / 100);
            const p2Share = item.amount * (split['Parent 2'] / 100);

            if (item.status === 'Settled') {
                p1Paid = p1Share;
                p2Paid = p2Share;
            } else {
                const p1InitialPaid = expense.paidBy === 'Parent 1' ? expense.amount : 0;
                const p2InitialPaid = expense.paidBy === 'Parent 2' ? expense.amount : 0;
                p1Paid = p1InitialPaid;
                p2Paid = p2InitialPaid;

                const p1Net = p1Share - p1InitialPaid;
                const p2Net = p2Share - p2InitialPaid;

                if (p1Net > 0) p1Owes = p1Net; else p1Credit = -p1Net;
                if (p2Net > 0) p2Owes = p2Net; else p2Credit = -p2Net;
            }
        }
        return { p1Paid, p2Paid, p1Owes, p2Owes, p1Credit, p2Credit };
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button variant="outline" size="icon" onClick={onMarkAllAsSettled} disabled={!hasUnsettledItems}>
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Mark All Settled</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button variant="outline" size="icon" onClick={onMarkAllAsUnsettled} disabled={!hasSettledItems}>
                      <CircleDot className="h-4 w-4" />
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Mark All Unsettled</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">More actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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
                  <SortableHeader sortKey="paidBy" className="w-[120px]">Paid By</SortableHeader>
                  <SortableHeader sortKey="status" className="w-[150px]">Settlement Status</SortableHeader>
                  <SortableHeader sortKey="amount" className="text-right w-[100px]">Total</SortableHeader>
                  <TableHead className="text-right w-[120px]">{parentNames['Parent 1']} Paid</TableHead>
                  <TableHead className="text-right w-[120px]">{parentNames['Parent 2']} Paid</TableHead>
                  <TableHead className="text-right w-[120px]">{parentNames['Parent 1']} Owes</TableHead>
                  <TableHead className="text-right w-[120px]">{parentNames['Parent 2']} Owes</TableHead>
                  <TableHead className="w-[50px] no-print text-center">Receipt</TableHead>
                  <TableHead className="w-[80px] no-print text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedItems.length > 0 ? (
                  filteredAndSortedItems.map((item) => {
                    const { p1Paid, p2Paid, p1Owes, p2Owes, p1Credit, p2Credit } = renderItemDetails(item);

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.description}
                          <div className="text-xs text-muted-foreground">{format(new Date(item.date), 'MMM d, yyyy')}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.category === 'Child Support' ? 'default' : 'outline'}>{item.category}</Badge>
                        </TableCell>
                        <TableCell>
                          {item.paidBy && item.paidBy !== 'None' && <Badge variant={item.paidBy === 'Parent 1' ? 'secondary' : 'outline'}>{parentNames[item.paidBy]}</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Switch
                              id={`settle-switch-desktop-${item.id}`}
                              checked={item.status === 'Settled'}
                              onCheckedChange={() => handleStatusToggle(item)}
                              aria-label={`Settle payment for ${item.description}`}
                            />
                            <Label htmlFor={`settle-switch-desktop-${item.id}`}>
                              {item.status}
                            </Label>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          ${item.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          ${p1Paid.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          ${p2Paid.toFixed(2)}
                        </TableCell>
                        <TableCell className={cn("text-right", p1Owes > 0 && "text-destructive font-semibold")}>
                          {p1Credit > 0 ? `($${p1Credit.toFixed(2)})` : `$${p1Owes.toFixed(2)}`}
                        </TableCell>
                        <TableCell className={cn("text-right", p2Owes > 0 && "text-destructive font-semibold")}>
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
                    <TableCell colSpan={11} className="h-24 text-center">
                      {searchTerm ? `No results for "${searchTerm}".` : `No ${statusFilter !== 'all' ? statusFilter : ''} transactions logged for this month.`}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              {filteredAndSortedItems.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={5}></TableCell>
                    <TableCell className="text-right text-xs font-medium text-muted-foreground">{parentNames['Parent 1']} Paid</TableCell>
                    <TableCell className="text-right text-xs font-medium text-muted-foreground">{parentNames['Parent 2']} Paid</TableCell>
                    <TableCell className="text-right text-xs font-medium text-muted-foreground">{parentNames['Parent 1']} Owes</TableCell>
                    <TableCell className="text-right text-xs font-medium text-muted-foreground">{parentNames['Parent 2']} Owes</TableCell>
                    <TableCell colSpan={2}></TableCell>
                  </TableRow>
                  <TableRow className="bg-secondary/50 font-bold">
                    <TableCell colSpan={5}>Totals</TableCell>
                    <TableCell className="text-right">
                      ${totals.totalP1Paid.toFixed(2)}
                    </TableCell>
                     <TableCell className="text-right">
                      ${totals.totalP2Paid.toFixed(2)}
                    </TableCell>
                    <TableCell className={cn("text-right", totals.totalP1Owes > 0 && "text-destructive")}>
                      ${totals.totalP1Owes.toFixed(2)}
                    </TableCell>
                    <TableCell className={cn("text-right", totals.totalP2Owes > 0 && "text-destructive")}>
                      ${totals.totalP2Owes.toFixed(2)}
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
                        <CardTitle className="text-lg">Totals for Filtered Items</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2 text-sm">
                            <h4 className="font-medium">{parentNames['Parent 1']}</h4>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Paid</span>
                                <span>${totals.totalP1Paid.toFixed(2)}</span>
                            </div>
                             <div className="flex justify-between">
                                <span className="text-muted-foreground">Owes</span>
                                <span className={cn(totals.totalP1Owes > 0 && "text-destructive font-semibold")}>${totals.totalP1Owes.toFixed(2)}</span>
                            </div>
                        </div>
                        <Separator />
                        <div className="space-y-2 text-sm">
                            <h4 className="font-medium">{parentNames['Parent 2']}</h4>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Paid</span>
                                <span>${totals.totalP2Paid.toFixed(2)}</span>
                            </div>
                             <div className="flex justify-between">
                                <span className="text-muted-foreground">Owes</span>
                                <span className={cn(totals.totalP2Owes > 0 && "text-destructive font-semibold")}>${totals.totalP2Owes.toFixed(2)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
             )}
            {filteredAndSortedItems.length > 0 ? (
                filteredAndSortedItems.map((item) => {
                    const { p1Paid, p2Paid, p1Owes, p2Owes, p1Credit, p2Credit } = renderItemDetails(item);
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
                                    <Badge variant={item.category === 'Child Support' ? 'default' : 'outline'}>{item.category}</Badge>
                                    <p className="font-bold text-lg">${item.amount.toFixed(2)}</p>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Paid By</span>
                                    {item.paidBy && item.paidBy !== 'None' && <Badge variant={item.paidBy === 'Parent 1' ? 'secondary' : 'outline'}>{parentNames[item.paidBy]}</Badge>}
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                     <span className="text-muted-foreground">Status</span>
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            id={`settle-switch-mobile-${item.id}`}
                                            checked={item.status === 'Settled'}
                                            onCheckedChange={() => handleStatusToggle(item)}
                                            aria-label={`Settle payment for ${item.description}`}
                                        />
                                        <Label htmlFor={`settle-switch-mobile-${item.id}`}>{item.status}</Label>
                                    </div>
                                </div>
                            </div>
                            {(p1Owes > 0 || p2Owes > 0 || p1Credit > 0 || p2Credit > 0) && (
                                <div className="bg-muted/50 px-4 py-3 text-sm space-y-2">
                                    <p className="font-medium text-xs text-muted-foreground">Balance Details</p>
                                     <div className="flex justify-between">
                                        <span className="text-muted-foreground">{parentNames['Parent 1']} Owes</span>
                                        <span className={cn(p1Owes > 0 && "text-destructive font-semibold")}>${p1Owes.toFixed(2)}</span>
                                     </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">{parentNames['Parent 2']} Owes</span>
                                        <span className={cn(p2Owes > 0 && "text-destructive font-semibold")}>${p2Owes.toFixed(2)}</span>
                                     </div>
                                </div>
                            )}
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

    
