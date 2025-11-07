'use client';

import { format, isAfter, startOfMonth, parse, isBefore, startOfDay } from 'date-fns';
import { ReceiptText, Trash2, Paperclip, Edit, Search, ArrowUpDown } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';

import type { AppData, ChildSupport, Expense, ExpenseSplit, MedicalExpenseSplit, Parent, ParentNames, PaymentStatus, Reimbursement } from '@/lib/types';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from './ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Button } from './ui/button';
import { EditExpenseDialog } from './edit-expense-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { useAppContext } from '@/context/app-context';
import { Input } from './ui/input';

interface AllUnsettledExpensesCardProps {
  appData: AppData;
  onUpdateExpense: (expense: Expense, originalMonthId: string) => void;
  onUpdateChildSupport: (childSupport: ChildSupport, monthId: string) => void;
  onUpdateReimbursement: (reimbursement: Reimbursement, monthId: string) => void;
  onDeleteExpense: (expenseId: string, monthId: string) => void;
  currentDate: Date;
  initialYearFilter?: string | null;
  initialMonthFilter?: string | null;
}

type UnsettledItem = {
  id: string; // expenseId or `cs-${monthId}`
  monthId: string;
  date: string;
  description: string;
  amount: number;
  paidBy: Parent | 'None';
  category: 'Child Support' | 'Reimbursement' | Expense['category'];
  type: 'expense' | 'child_support' | 'reimbursement';
  receiptUrl?: string | null;
  receiptFilename?: string | null;
  parentNames: ParentNames;
  expenseSplit: ExpenseSplit;
  medicalExpenseSplit: MedicalExpenseSplit;
  originalExpense?: Expense;
  originalChildSupport?: ChildSupport;
  originalReimbursement?: Reimbursement;
  status: PaymentStatus;
};

type SortKey = 'date' | 'description' | 'category' | 'paidBy' | 'amount';
type SortConfig = {
  key: SortKey;
  direction: 'ascending' | 'descending';
} | null;

export function AllUnsettledExpensesCard({
  appData,
  onUpdateExpense,
  onUpdateChildSupport,
  onUpdateReimbursement,
  onDeleteExpense,
  currentDate,
  initialYearFilter,
  initialMonthFilter,
}: AllUnsettledExpensesCardProps) {
  const { toast } = useToast();
  const { batchUpdateMonths } = useAppContext();
  const [yearFilter, setYearFilter] = useState<string>(initialYearFilter || 'all');
  const [monthFilter, setMonthFilter] = useState<string>(initialMonthFilter || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'descending' });

  useEffect(() => {
    if (initialYearFilter) setYearFilter(initialYearFilter);
    if (initialMonthFilter) setMonthFilter(initialMonthFilter);
  }, [initialYearFilter, initialMonthFilter]);

  const { availableYears, availableMonths } = useMemo(() => {
    if (!appData?.months) return { availableYears: [], availableMonths: [] };

    const years = new Set<string>();
    Object.keys(appData.months).forEach(monthId => years.add(monthId.substring(0, 4)));
    const sortedYears = Array.from(years).sort().reverse();

    const months = Object.keys(appData.months)
      .filter(monthId => yearFilter !== 'all' && monthId.startsWith(yearFilter))
      .sort()
      .reverse()
      .map(monthId => ({
        value: monthId,
        label: format(parse(monthId, 'yyyy-MM', new Date()), 'MMMM'),
      }));
      
    return { availableYears: sortedYears, availableMonths: months };
  }, [appData.months, yearFilter]);

  useEffect(() => {
    if (yearFilter === 'all') {
      setMonthFilter('all');
    }
  }, [yearFilter]);


  const allUnsettledItems = useMemo<UnsettledItem[]>(() => {
    let items: UnsettledItem[] = [];
    if (!appData?.months) return items;
    
    let monthIdsToProcess: string[] = Object.keys(appData.months);
    
    for (const monthId of monthIdsToProcess) {
      if (!appData.months[monthId]) continue;

      const monthData = appData.months[monthId];
      const monthDate = parse(monthId, 'yyyy-MM', new Date());
      const isFutureMonth = isAfter(monthDate, startOfMonth(new Date()));

      monthData.expenses
        .filter((exp) => exp.status === 'Unsettled')
        .forEach((exp) => {
          items.push({
            ...exp,
            monthId,
            type: 'expense',
            originalExpense: exp,
            parentNames: monthData.parentNames,
            expenseSplit: monthData.expenseSplit,
            medicalExpenseSplit: monthData.medicalExpenseSplit,
          });
        });

      if (monthData.childSupport.amount > 0 && monthData.childSupport.paidBy !== 'None' && monthData.childSupport.status === 'Unsettled' && !isFutureMonth) {
        items.push({
          id: `cs-${monthId}`,
          monthId,
          date: new Date(monthData.year, monthData.month - 1, 1, 12).toISOString(),
          description: 'Child Support',
          amount: monthData.childSupport.amount,
          paidBy: monthData.childSupport.paidBy,
          category: 'Child Support',
          type: 'child_support',
          parentNames: monthData.parentNames,
          expenseSplit: monthData.expenseSplit, 
          medicalExpenseSplit: monthData.medicalExpenseSplit,
          originalChildSupport: monthData.childSupport,
          status: 'Unsettled',
        });
      }

      if (monthData.reimbursement.amount > 0 && monthData.reimbursement.paidBy !== 'None' && monthData.reimbursement.status === 'Unsettled' && !isFutureMonth) {
        items.push({
          id: `rb-${monthId}`,
          monthId,
          date: new Date(monthData.year, monthData.month - 1, 1, 12).toISOString(),
          description: 'Reimbursement',
          amount: monthData.reimbursement.amount,
          paidBy: monthData.reimbursement.paidBy,
          category: 'Reimbursement',
          type: 'reimbursement',
          parentNames: monthData.parentNames,
          expenseSplit: monthData.expenseSplit,
          medicalExpenseSplit: monthData.medicalExpenseSplit,
          originalReimbursement: monthData.reimbursement,
          status: 'Unsettled',
        });
      }
    }
    return items;
  }, [appData.months]);

  const renderItemDetails = (item: UnsettledItem) => {
    let p1Owes = 0;
    let p2Owes = 0;
  
    if (item.type === 'child_support' || item.type === 'reimbursement') {
      if (item.paidBy === 'Parent 1') {
        p1Owes = item.amount;
      } else if (item.paidBy === 'Parent 2') {
        p2Owes = item.amount;
      }
    } else {
      const expense = item as Expense;
      let p1Share: number, p2Share: number;
  
      const split = expense.category === 'Medical' || expense.category === 'Child Care' ? item.medicalExpenseSplit : item.expenseSplit;
      p1Share = expense.amount * (split['Parent 1'] / 100);
      p2Share = expense.amount * (split['Parent 2'] / 100);
      
      const p1InitialPaid = expense.paidBy === 'Parent 1' ? expense.amount : 0;
      const p2InitialPaid = expense.paidBy === 'Parent 2' ? expense.amount : 0;
  
      p1Owes = p1Share - p1InitialPaid;
      p2Owes = p2Share - p2InitialPaid;
    }
    
    return { p1Owes, p2Owes };
  };

  const filteredAndSortedItems = useMemo(() => {
    let items = [...allUnsettledItems];

    if (yearFilter !== 'all') {
      items = items.filter(item => item.monthId.startsWith(yearFilter));
    }
    if (monthFilter !== 'all') {
      items = items.filter(item => item.monthId === monthFilter);
    }
    
    const lowercasedFilter = searchTerm.toLowerCase();
    if (lowercasedFilter) {
        items = items.filter(item => {
            const paidByName = item.paidBy && item.paidBy !== 'None' ? item.parentNames[item.paidBy].toLowerCase() : '';
            return item.description.toLowerCase().includes(lowercasedFilter) ||
                   item.category.toLowerCase().includes(lowercasedFilter) ||
                   paidByName.includes(lowercasedFilter);
        });
    }

    if (sortConfig !== null) {
      items.sort((a, b) => {
        let aValue: string | number;
        let bValue: string | number;

        if (sortConfig.key === 'paidBy') {
            aValue = a.paidBy === 'None' ? '' : a.parentNames[a.paidBy];
            bValue = b.paidBy === 'None' ? '' : b.parentNames[b.paidBy];
        } else {
             aValue = a[sortConfig.key as keyof UnsettledItem];
             bValue = b[sortConfig.key as keyof UnsettledItem];
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
  }, [allUnsettledItems, yearFilter, monthFilter, searchTerm, sortConfig]);
  
  const handleStatusToggle = (item: UnsettledItem) => {
    const newStatus: PaymentStatus = 'Settled';
    
    if (item.type === 'expense' && item.originalExpense) {
        onUpdateExpense({ ...item.originalExpense, status: newStatus }, item.monthId);
    } else if (item.type === 'child_support' && item.originalChildSupport) {
        onUpdateChildSupport({ ...item.originalChildSupport, status: newStatus }, item.monthId);
    } else if (item.type === 'reimbursement' && item.originalReimbursement) {
        onUpdateReimbursement({ ...item.originalReimbursement, status: newStatus }, item.monthId);
    }

     toast({
      title: `Item Marked as ${newStatus}`,
      description: `"${item.description}" has been updated.`,
    });
  };

  const handleMarkVisibleSettled = () => {
    const itemsToSettle = filteredAndSortedItems;

    if (itemsToSettle.length === 0) {
      toast({
        title: 'No Items to Settle',
        description: 'There are no visible unsettled items to mark as settled.',
      });
      return;
    }

    const monthUpdates: { [monthId: string]: { expenses: Expense[], childSupport: ChildSupport, reimbursement: Reimbursement } } = {};

    itemsToSettle.forEach(item => {
      const { monthId } = item;
      if (!appData.months[monthId]) return;

      if (!monthUpdates[monthId]) {
        // Create a mutable copy of the month's data if it's the first time we're updating it
        monthUpdates[monthId] = {
          expenses: [...appData.months[monthId].expenses],
          childSupport: { ...appData.months[monthId].childSupport },
          reimbursement: { ...appData.months[monthId].reimbursement }
        };
      }

      if (item.type === 'expense' && item.originalExpense) {
        const expenseIndex = monthUpdates[monthId].expenses.findIndex(e => e.id === item.id);
        if (expenseIndex !== -1) {
          monthUpdates[monthId].expenses[expenseIndex] = {
            ...monthUpdates[monthId].expenses[expenseIndex],
            status: 'Settled'
          };
        }
      } else if (item.type === 'child_support' && item.originalChildSupport) {
        monthUpdates[monthId].childSupport = {
          ...monthUpdates[monthId].childSupport,
          status: 'Settled'
        };
      } else if (item.type === 'reimbursement' && item.originalReimbursement) {
        monthUpdates[monthId].reimbursement = {
          ...monthUpdates[monthId].reimbursement,
          status: 'Settled'
        };
      }
    });

    batchUpdateMonths(monthUpdates);

    toast({
      title: 'Visible Items Marked as Settled',
      description: `${itemsToSettle.length} items have been updated.`,
    });
  };

  const totals = useMemo(() => {
    return filteredAndSortedItems.reduce(
      (acc, item) => {
        let p1Paid = 0;
        let p2Paid = 0;
        
        const { p1Owes, p2Owes } = renderItemDetails(item);

        if (item.type === 'expense') {
            p1Paid = item.paidBy === 'Parent 1' ? item.amount : 0;
            p2Paid = item.paidBy === 'Parent 2' ? item.amount : 0;
        }

        acc.totalAmount += item.amount;
        acc.totalP1Paid += p1Paid;
        acc.totalP2Paid += p2Paid;
        acc.totalP1Owes += p1Owes;
        acc.totalP2Owes += p2Owes;
        
        return acc;
      },
      { totalAmount: 0, totalP1Paid: 0, totalP2Paid: 0, totalP1Owes: 0, totalP2Owes: 0 }
    );
  }, [filteredAndSortedItems]);

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

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <ReceiptText className="h-5 w-5 text-secondary-foreground" />
              </span>
              <div>
                <CardTitle>All Unsettled Items</CardTitle>
                <CardDescription>
                  A ledger of all outstanding expenses and payments across all months.
                </CardDescription>
              </div>
            </div>
             <div className="no-print flex w-full flex-wrap items-center justify-end gap-2">
                 <Button 
                    variant="outline"
                    onClick={() => {
                        setYearFilter('all');
                        setMonthFilter('all');
                    }}
                    disabled={yearFilter === 'all' && monthFilter === 'all'}
                    className="w-full sm:w-auto"
                >
                    Show All
                </Button>
                <Button 
                    onClick={handleMarkVisibleSettled} 
                    disabled={filteredAndSortedItems.length === 0}
                    className="w-full sm:w-auto"
                >
                    Mark Visible Settled
                </Button>
            </div>
        </div>
        <div className="no-print flex flex-col sm:flex-row sm:items-center gap-4 mt-4">
            <div className="flex flex-wrap items-center gap-2">
                <Select value={yearFilter} onValueChange={setYearFilter}>
                    <SelectTrigger className="w-full sm:w-[120px]">
                    <SelectValue placeholder="Select Year" />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {availableYears.map(year => (
                        <SelectItem key={year} value={year}>
                        {year}
                        </SelectItem>
                    ))}
                    </SelectContent>
                </Select>

                <Select value={monthFilter} onValueChange={setMonthFilter} disabled={availableMonths.length === 0 || yearFilter === 'all'}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filter by month" />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {availableMonths.map(month => (
                        <SelectItem key={month.value} value={month.value}>
                        {month.label}
                        </SelectItem>
                    ))}
                    </SelectContent>
                </Select>
            </div>
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
        </div>
      </CardHeader>
      <CardContent>
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader sortKey="description">Description</SortableHeader>
                <SortableHeader sortKey="category" className="w-[140px]">Category</SortableHeader>
                <SortableHeader sortKey="paidBy" className="w-[120px]">Paid By</SortableHeader>
                <TableHead className="w-[150px]">Settlement Status</TableHead>
                <TableHead className="text-right w-[100px]">Total</TableHead>
                <TableHead className="text-right w-[120px]">{appData.months[Object.keys(appData.months)[0]].parentNames['Parent 1']} Paid</TableHead>
                <TableHead className="text-right w-[120px]">{appData.months[Object.keys(appData.months)[0]].parentNames['Parent 2']} Paid</TableHead>
                <TableHead className="text-right w-[120px]">{appData.months[Object.keys(appData.months)[0]].parentNames['Parent 1']} Owes</TableHead>
                <TableHead className="text-right w-[120px]">{appData.months[Object.keys(appData.months)[0]].parentNames['Parent 2']} Owes</TableHead>
                <TableHead className="w-[50px] no-print text-center">Receipt</TableHead>
                <TableHead className="w-[80px] no-print text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedItems.length > 0 ? (
                filteredAndSortedItems.map((item) => {
                  const { p1Owes, p2Owes } = renderItemDetails(item);
                  const p1DisplayPaid = item.type === 'expense' && item.paidBy === 'Parent 1' ? item.amount : 0;
                  const p2DisplayPaid = item.type === 'expense' && item.paidBy === 'Parent 2' ? item.amount : 0;
                  
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.description}
                        <div className="text-xs text-muted-foreground">{format(new Date(item.date), 'MMM d, yyyy')}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.category === 'Child Support' || item.category === 'Reimbursement' ? 'default' : 'outline'}>{item.category}</Badge>
                      </TableCell>
                      <TableCell>
                        {item.paidBy && item.paidBy !== 'None' && <Badge variant={item.paidBy === 'Parent 1' ? 'secondary' : 'outline'}>{item.parentNames[item.paidBy]}</Badge>}
                      </TableCell>
                       <TableCell>
                         <div className="flex items-center space-x-2">
                           <Switch
                             id={`status-switch-all-${item.id}`}
                             checked={false} // Always off for unsettled items
                             onCheckedChange={() => handleStatusToggle(item)}
                           />
                           <Label htmlFor={`status-switch-all-${item.id}`} className="text-muted-foreground">Unsettled</Label>
                         </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ${item.amount.toFixed(2)}
                      </TableCell>
                       <TableCell className="text-right">
                           ${p1DisplayPaid.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                           ${p2DisplayPaid.toFixed(2)}
                        </TableCell>
                      <TableCell className={cn("text-right", p1Owes < 0 && "text-green-600", p1Owes > 0 && "text-destructive")}>
                        {p1Owes < 0 ? `($${Math.abs(p1Owes).toFixed(2)})` : `$${p1Owes.toFixed(2)}`}
                      </TableCell>
                      <TableCell className={cn("text-right", p2Owes < 0 && "text-green-600", p2Owes > 0 && "text-destructive")}>
                        {p2Owes < 0 ? `($${Math.abs(p2Owes).toFixed(2)})` : `$${p2Owes.toFixed(2)}`}
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
                          {item.type === 'expense' && item.originalExpense && (
                            <>
                              <EditExpenseDialog
                                expense={item.originalExpense}
                                onUpdateExpense={(expense) => onUpdateExpense(expense, item.monthId)}
                                parentNames={item.parentNames}
                                monthId={item.monthId}
                              />
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => onDeleteExpense(item.id, item.monthId)}
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
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={11} className="h-24 text-center">
                     {searchTerm ? `No results for "${searchTerm}".` : `No unsettled items for the selected period.`}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
             {filteredAndSortedItems.length > 0 && (
                 <TableFooter>
                    <TableRow>
                        <TableCell colSpan={5}></TableCell>
                        <TableCell className="text-right text-xs font-medium text-muted-foreground">{appData.months[Object.keys(appData.months)[0]].parentNames['Parent 1']} Paid</TableCell>
                        <TableCell className="text-right text-xs font-medium text-muted-foreground">{appData.months[Object.keys(appData.months)[0]].parentNames['Parent 2']} Paid</TableCell>
                        <TableCell className="text-right text-xs font-medium text-muted-foreground">{appData.months[Object.keys(appData.months)[0]].parentNames['Parent 1']} Owes</TableCell>
                        <TableCell className="text-right text-xs font-medium text-muted-foreground">{appData.months[Object.keys(appData.months)[0]].parentNames['Parent 2']} Owes</TableCell>
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
                        <TableCell className={cn("text-right", totals.totalP1Owes < 0 && "text-green-600", totals.totalP1Owes > 0 && "text-destructive")}>
                          {totals.totalP1Owes < 0 ? `($${Math.abs(totals.totalP1Owes).toFixed(2)})` : `$${totals.totalP1Owes.toFixed(2)}`}
                        </TableCell>
                        <TableCell className={cn("text-right", totals.totalP2Owes < 0 && "text-green-600", totals.totalP2Owes > 0 && "text-destructive")}>
                          {totals.totalP2Owes < 0 ? `($${Math.abs(totals.totalP2Owes).toFixed(2)})` : `$${totals.totalP2Owes.toFixed(2)}`}
                        </TableCell>
                        <TableCell colSpan={2}></TableCell>
                    </TableRow>
                 </TableFooter>
            )}
          </Table>
        </div>

        {/* Mobile Card View */}
        <div className="space-y-4 md:hidden">
            {filteredAndSortedItems.length > 0 ? (
                filteredAndSortedItems.map((item) => {
                    const { p1Owes, p2Owes } = renderItemDetails(item);
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
                                        {item.type === 'expense' && item.originalExpense && (
                                            <>
                                            <EditExpenseDialog
                                                expense={item.originalExpense}
                                                onUpdateExpense={(expense) => onUpdateExpense(expense, item.monthId)}
                                                parentNames={item.parentNames}
                                                monthId={item.monthId}
                                            />
                                            <TooltipProvider>
                                                <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDeleteExpense(item.id, item.monthId)}>
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
                                    <Badge variant={item.category === 'Child Support' || item.category === 'Reimbursement' ? 'default' : 'outline'}>{item.category}</Badge>
                                    <p className="font-bold text-lg">${item.amount.toFixed(2)}</p>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Paid By</span>
                                    {item.paidBy && item.paidBy !== 'None' && <Badge variant={item.paidBy === 'Parent 1' ? 'secondary' : 'outline'}>{item.parentNames[item.paidBy]}</Badge>}
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                     <span className="text-muted-foreground">Status</span>
                                    <div className="flex items-center space-x-2">
                                       <Switch
                                         id={`status-switch-all-mobile-${item.id}`}
                                         checked={false} // Always off for unsettled items
                                         onCheckedChange={() => handleStatusToggle(item)}
                                       />
                                       <Label htmlFor={`status-switch-all-mobile-${item.id}`} className="text-muted-foreground">Unsettled</Label>
                                     </div>
                                </div>
                            </div>
                            <div className="bg-muted/50 px-4 py-3 text-sm space-y-2">
                                <p className="font-medium text-xs text-muted-foreground">Balance Details</p>
                                    <div className="flex justify-between">
                                    <span className="text-muted-foreground">{item.parentNames['Parent 1']} Owes</span>
                                    <span className={cn("font-semibold", p1Owes > 0 && "text-destructive", p1Owes < 0 && "text-green-600")}>
                                        {p1Owes < 0 ? `-$${Math.abs(p1Owes).toFixed(2)}` : `$${p1Owes.toFixed(2)}`}
                                    </span>
                                    </div>
                                    <div className="flex justify-between">
                                    <span className="text-muted-foreground">{item.parentNames['Parent 2']} Owes</span>
                                    <span className={cn("font-semibold", p2Owes > 0 && "text-destructive", p2Owes < 0 && "text-green-600")}>
                                        {p2Owes < 0 ? `-$${Math.abs(p2Owes).toFixed(2)}` : `$${p2Owes.toFixed(2)}`}
                                    </span>
                                    </div>
                            </div>
                        </Card>
                    );
                })
            ) : (
                <div className="h-32 text-center flex flex-col justify-center items-center">
                    <p className="text-muted-foreground">
                        {searchTerm ? `No results for "${searchTerm}".` : `No unsettled items for the selected period.`}
                    </p>
                </div>
            )}
        </div>

      </CardContent>
    </Card>
  );
}
