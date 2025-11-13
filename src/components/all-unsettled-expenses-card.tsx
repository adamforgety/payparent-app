

'use client';

import { format, isAfter, startOfMonth, parse, getYear } from 'date-fns';
import { ReceiptText, Trash2, Paperclip, Edit, Search, ArrowUpDown } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';

import type { AppData, ChildSupport, Expense, ExpenseSplit, MedicalExpenseSplit, Parent, ParentNames, PaymentStatus } from '@/lib/types';
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';

interface AllUnsettledExpensesCardProps {
  appData: AppData;
  onUpdateExpense: (expense: Expense, originalMonthId: string) => void;
  onUpdateChildSupport: (childSupport: ChildSupport, monthId: string) => void;
  onDeleteExpense: (expenseId: string, monthId: string) => void;
  currentDate: Date;
  isDashboardAllMonthsView: boolean;
}

type UnsettledItem = {
  id: string; // expenseId or `cs-${monthId}`
  monthId: string;
  date: string;
  description: string;
  amount: number;
  paidBy: Parent | 'None';
  category: 'Child Support' | Expense['category'];
  type: 'expense' | 'child_support';
  receiptUrl?: string | null;
  receiptFilename?: string | null;
  parentNames: ParentNames;
  expenseSplit: ExpenseSplit;
  medicalExpenseSplit: MedicalExpenseSplit;
  originalExpense?: Expense;
  originalChildSupport?: ChildSupport;
  status: PaymentStatus;
};

type GroupedUnsettledItems = {
    [monthId: string]: {
        items: UnsettledItem[];
        totalAmount: number;
        totalP1Share: number;
        totalP2Share: number;
    }
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
  onDeleteExpense,
  currentDate,
  isDashboardAllMonthsView,
}: AllUnsettledExpensesCardProps) {
  const { toast } = useToast();
  const { batchUpdateMonths } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'descending' });
  const [showAllMonths, setShowAllMonths] = useState(isDashboardAllMonthsView);

  useEffect(() => {
    setShowAllMonths(isDashboardAllMonthsView);
  }, [isDashboardAllMonthsView]);


  const parentNames = useMemo(() => {
    if (!appData?.months || Object.keys(appData.months).length === 0) {
      return { 'Parent 1': 'Parent 1', 'Parent 2': 'Parent 2' };
    }
    const firstMonthId = Object.keys(appData.months)[0];
    return appData.months[firstMonthId].parentNames;
  }, [appData.months]);
  
  const getParentShare = (item: UnsettledItem, parent: Parent): number => {
    if (item.type === 'child_support') {
      return item.paidBy === parent ? item.amount : 0;
    }
  
    const expense = item as Expense;
    if (expense.category === 'Reimbursement') {
      // The parent who paid gets 0 share of the cost, the other parent gets 100%
      return expense.paidBy === parent ? 0 : expense.amount;
    }
  
    const split = expense.category === 'Medical' || expense.category === 'Child Care'
      ? item.medicalExpenseSplit
      : item.expenseSplit;
  
    return expense.amount * (split[parent] / 100);
  };
  
  const filteredAndSortedItems = useMemo(() => {
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
    }
    
    const yearFilter = String(getYear(currentDate));
    const monthFilter = format(currentDate, 'yyyy-MM');

    if (showAllMonths) {
      items = items.filter(item => item.monthId.startsWith(yearFilter));
    } else {
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
  }, [appData, currentDate, showAllMonths, searchTerm, sortConfig]);

  const groupedItems = useMemo<GroupedUnsettledItems>(() => {
    return filteredAndSortedItems.reduce((acc, item) => {
      const { monthId } = item;
      if (!acc[monthId]) {
        acc[monthId] = { items: [], totalAmount: 0, totalP1Share: 0, totalP2Share: 0 };
      }
      acc[monthId].items.push(item);
      if (item.category !== 'Reimbursement') {
        acc[monthId].totalAmount += item.amount;
      }
      acc[monthId].totalP1Share += getParentShare(item, 'Parent 1');
      acc[monthId].totalP2Share += getParentShare(item, 'Parent 2');
      return acc;
    }, {} as GroupedUnsettledItems);
  }, [filteredAndSortedItems]);

  const sortedGroupKeys = useMemo(() => {
    return Object.keys(groupedItems).sort((a, b) => b.localeCompare(a));
  }, [groupedItems]);
  
  const handleStatusToggle = (item: UnsettledItem) => {
    const newStatus: PaymentStatus = 'Settled';
    
    if (item.type === 'expense' && item.originalExpense) {
        onUpdateExpense({ ...item.originalExpense, status: newStatus }, item.monthId);
    } else if (item.type === 'child_support' && item.originalChildSupport) {
        onUpdateChildSupport({ ...item.originalChildSupport, status: newStatus }, item.monthId);
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

    const monthUpdates: { [monthId: string]: { expenses: Expense[], childSupport: ChildSupport } } = {};

    itemsToSettle.forEach(item => {
      const { monthId } = item;
      if (!appData.months[monthId]) return;

      if (!monthUpdates[monthId]) {
        monthUpdates[monthId] = {
          expenses: [...appData.months[monthId].expenses],
          childSupport: { ...appData.months[monthId].childSupport },
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
      }
    });

    batchUpdateMonths(monthUpdates);

    toast({
      title: 'Visible Items Marked as Settled',
      description: `${itemsToSettle.length} items have been updated.`,
    });
  };

  const grandTotals = useMemo(() => {
    return Object.values(groupedItems).reduce(
      (acc, monthGroup) => {
        acc.totalAmount += monthGroup.totalAmount;
        acc.totalP1Share += monthGroup.totalP1Share;
        acc.totalP2Share += monthGroup.totalP2Share;
        return acc;
      },
      { totalAmount: 0, totalP1Share: 0, totalP2Share: 0 }
    );
  }, [groupedItems]);

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
             <div className="no-print flex w-full flex-wrap items-center justify-end gap-4">
                <div className="flex items-center space-x-2">
                    <Switch
                        id="show-all-months-switch"
                        checked={showAllMonths}
                        onCheckedChange={setShowAllMonths}
                    />
                    <Label htmlFor="show-all-months-switch">Show All Months</Label>
                </div>
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
        {sortedGroupKeys.length > 0 ? (
          <>
            <Accordion type="multiple" defaultValue={sortedGroupKeys}>
              {sortedGroupKeys.map((monthId) => {
                const monthGroup = groupedItems[monthId];
                if (!monthGroup) return null;
                const p1Balance = monthGroup.totalP1Share;
                const p2Balance = monthGroup.totalP2Share;

                return (
                    <AccordionItem value={monthId} key={monthId}>
                        <AccordionTrigger className="hover:no-underline">
                            <div className="flex w-full items-center justify-between pr-4">
                                <span className="font-semibold text-lg">{format(parse(monthId, 'yyyy-MM', new Date()), 'MMMM yyyy')}</span>
                                <div className="text-right text-sm">
                                    <p className="font-medium text-muted-foreground">{monthGroup.items.length} items</p>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                           <div className="overflow-x-auto rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="w-[140px]">Category</TableHead>
                                            <TableHead className="w-[140px]">Initial Payer</TableHead>
                                            <TableHead className="w-[150px]">Status</TableHead>
                                            <TableHead className="text-right w-[120px]">Initial Amount</TableHead>
                                            <TableHead className="text-right w-[120px]">{parentNames['Parent 1']}'s Share</TableHead>
                                            <TableHead className="text-right w-[120px]">{parentNames['Parent 2']}'s Share</TableHead>
                                            <TableHead className="w-[50px] text-center">Receipt</TableHead>
                                            <TableHead className="w-[80px] text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {monthGroup.items.map((item) => {
                                            const p1Share = getParentShare(item, 'Parent 1');
                                            const p2Share = getParentShare(item, 'Parent 2');
                                            const isP1Reimbursed = item.category === 'Reimbursement' && item.paidBy === 'Parent 1';
                                            const isP2Reimbursed = item.category === 'Reimbursement' && item.paidBy === 'Parent 2';

                                            let p1Color, p2Color;
                                            if (item.type === 'child_support') {
                                                if (item.paidBy === 'Parent 1') { p1Color = 'text-destructive'; p2Color = 'text-green-600'; } 
                                                else { p1Color = 'text-green-600'; p2Color = 'text-destructive'; }
                                            } else {
                                                p1Color = item.paidBy === 'Parent 1' ? 'text-green-600' : 'text-destructive';
                                                p2Color = item.paidBy === 'Parent 2' ? 'text-green-600' : 'text-destructive';
                                            }

                                            return (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium">
                                                    {item.description}
                                                    <div className="text-xs text-muted-foreground">{format(new Date(item.date), 'MMM d, yyyy')}</div>
                                                </TableCell>
                                                <TableCell><Badge variant={item.category === 'Child Support' ? 'default' : item.category === 'Reimbursement' ? 'reimbursement' : 'outline'}>{item.category}</Badge></TableCell>
                                                <TableCell>{item.paidBy && item.paidBy !== 'None' && <Badge variant={item.paidBy === 'Parent 1' ? 'secondary' : 'info'}>{item.parentNames[item.paidBy]}</Badge>}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center space-x-2">
                                                        <Switch id={`status-switch-all-${item.id}`} checked={false} onCheckedChange={() => handleStatusToggle(item)} />
                                                        <Label htmlFor={`status-switch-all-${item.id}`} className="w-16 text-destructive">Unsettled</Label>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-semibold">${item.amount.toFixed(2)}</TableCell>
                                                <TableCell className={cn("text-right", p1Color)}>{isP1Reimbursed ? `($${item.amount.toFixed(2)})` : `$${p1Share.toFixed(2)}`}</TableCell>
                                                <TableCell className={cn("text-right", p2Color)}>{isP2Reimbursed ? `($${item.amount.toFixed(2)})` : `$${p2Share.toFixed(2)}`}</TableCell>
                                                <TableCell className="text-center">
                                                    {item.type === 'expense' && item.receiptUrl && (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" asChild><a href={item.receiptUrl} target="_blank" rel="noopener noreferrer"><Paperclip className="h-4 w-4 text-muted-foreground" /></a></Button></TooltipTrigger>
                                                            <TooltipContent>View Receipt</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1 h-8 w-full">
                                                    {item.type === 'expense' && item.originalExpense && (
                                                        <>
                                                        <EditExpenseDialog expense={item.originalExpense} onUpdateExpense={(expense) => onUpdateExpense(expense, item.monthId)} parentNames={item.parentNames} monthId={item.monthId}/>
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDeleteExpense(item.id, item.monthId)}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button></TooltipTrigger>
                                                                <TooltipContent>Delete</TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                        </>
                                                    )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                    <TableFooter>
                                        <TableRow className="bg-secondary/50 font-bold">
                                            <TableCell colSpan={4}>Month Totals</TableCell>
                                            <TableCell className="text-right">${monthGroup.totalAmount.toFixed(2)}</TableCell>
                                            <TableCell className="text-right">${p1Balance.toFixed(2)}</TableCell>
                                            <TableCell className="text-right">${p2Balance.toFixed(2)}</TableCell>
                                            <TableCell colSpan={2}></TableCell>
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                );
              })}
            </Accordion>
            <div className="mt-6 rounded-lg border bg-background p-4">
                <h3 className="font-semibold text-lg mb-2">Grand Totals</h3>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Initial Amount</span>
                        <span className="font-semibold">${grandTotals.totalAmount.toFixed(2)}</span>
                    </div>
                     <div className="flex justify-between">
                        <span className="text-muted-foreground">{parentNames['Parent 1']}'s Total Share</span>
                        <span className="font-semibold">${grandTotals.totalP1Share.toFixed(2)}</span>
                    </div>
                     <div className="flex justify-between">
                        <span className="text-muted-foreground">{parentNames['Parent 2']}'s Total Share</span>
                        <span className="font-semibold">${grandTotals.totalP2Share.toFixed(2)}</span>
                    </div>
                </div>
            </div>
          </>
        ) : (
            <div className="h-32 text-center flex flex-col justify-center items-center">
                <p className="text-muted-foreground">
                    {searchTerm ? `No results for "${searchTerm}".` : `No unsettled items for the selected period.`}
                </p>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
