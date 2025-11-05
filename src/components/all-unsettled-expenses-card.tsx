'use client';

import { format, isAfter, startOfMonth, parse } from 'date-fns';
import { ReceiptText, Trash2, Paperclip, Edit, CheckCircle } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';

import type { AppData, ChildSupport, Expense, ExpenseSplit, MedicalExpenseSplit, Parent, ParentNames, PaymentStatus } from '@/lib/types';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from './ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Button } from './ui/button';
import { EditExpenseDialog } from './edit-expense-dialog';
import { useToast } from '@/hooks/use-toast';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AllUnsettledExpensesCardProps {
  appData: AppData;
  onUpdateExpense: (expense: Expense, originalMonthId: string) => void;
  onUpdateChildSupport: (childSupport: ChildSupport, monthId: string) => void;
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
  category: 'Child Support' | Expense['category'];
  type: 'expense' | 'child_support';
  receiptUrl?: string | null;
  receiptFilename?: string | null;
  parentNames: ParentNames;
  expenseSplit: ExpenseSplit;
  medicalExpenseSplit: MedicalExpenseSplit;
  originalExpense?: Expense;
  originalChildSupport?: ChildSupport;
};

export function AllUnsettledExpensesCard({
  appData,
  onUpdateExpense,
  onUpdateChildSupport,
  onDeleteExpense,
  currentDate,
  initialYearFilter,
  initialMonthFilter,
}: AllUnsettledExpensesCardProps) {
  const { toast } = useToast();
  const [yearFilter, setYearFilter] = useState<string>(initialYearFilter || String(currentDate.getFullYear()));
  const [monthFilter, setMonthFilter] = useState<string>(initialMonthFilter || 'all');

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
      .filter(monthId => monthId.startsWith(yearFilter))
      .sort()
      .reverse()
      .map(monthId => ({
        value: monthId,
        label: format(parse(monthId, 'yyyy-MM', new Date()), 'MMMM'),
      }));
      
    return { availableYears: sortedYears, availableMonths: months };
  }, [appData.months, yearFilter]);

  useEffect(() => {
    // Reset month filter if it's not valid for the new year
    if (monthFilter !== 'all' && !monthFilter.startsWith(yearFilter)) {
      setMonthFilter('all');
    }
  }, [yearFilter, monthFilter]);


  const allUnsettledItems = useMemo<UnsettledItem[]>(() => {
    let items: UnsettledItem[] = [];
    if (!appData?.months) return items;
    
    let monthIdsToProcess: string[] = [];

    if (monthFilter === 'all') {
      monthIdsToProcess = Object.keys(appData.months).filter(m => m.startsWith(yearFilter));
    } else {
      monthIdsToProcess = [monthFilter];
    }
    
    for (const monthId of monthIdsToProcess) {
      if (!appData.months[monthId]) continue;

      const monthData = appData.months[monthId];
      const monthDate = parse(monthId, 'yyyy-MM', new Date());
      const isFutureMonth = isAfter(monthDate, startOfMonth(new Date()));

      // Add unsettled expenses
      monthData.expenses
        .filter((exp) => exp.status === 'Unsettled')
        .forEach((exp) => {
          items.push({
            id: exp.id,
            monthId,
            date: exp.date,
            description: exp.description,
            amount: exp.amount,
            paidBy: exp.paidBy,
            category: exp.category,
            type: 'expense',
            receiptUrl: exp.receiptUrl,
            receiptFilename: exp.receiptFilename,
            parentNames: monthData.parentNames,
            expenseSplit: monthData.expenseSplit,
            medicalExpenseSplit: monthData.medicalExpenseSplit,
            originalExpense: exp,
          });
        });

      // Add unsettled child support (if not in a future month)
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
        });
      }
    }

    // Sort by date descending
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [appData.months, yearFilter, monthFilter]);
  
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

  const handleMarkAllSettled = () => {
    if (allUnsettledItems.length === 0) {
      toast({
        title: 'No Items to Settle',
        description: 'There are no unsettled items in the current view.',
      });
      return;
    }
    
    allUnsettledItems.forEach(item => {
        if (item.type === 'expense' && item.originalExpense) {
            onUpdateExpense({ ...item.originalExpense, status: 'Settled' }, item.monthId);
        } else if (item.type === 'child_support' && item.originalChildSupport) {
            onUpdateChildSupport({ ...item.originalChildSupport, status: 'Settled' }, item.monthId);
        }
    });

    toast({
        title: 'All Items Marked as Settled',
        description: `${allUnsettledItems.length} items have been updated.`,
    });
  };

  const { totalAmount, totalParent1Owes, totalParent2Owes } = useMemo(() => {
     let amount = 0;
     let p1Owes = 0;
     let p2Owes = 0;

     allUnsettledItems.forEach(item => {
        amount += item.amount;
        
        let p1Share = 0;
        let p2Share = 0;
        let p1Paid = 0;
        let p2Paid = 0;

        if (item.type === 'expense') {
          const expense = item.originalExpense!;
          if (expense.category === 'Medical' || expense.category === 'Child Care') {
            p1Share = item.amount * (item.medicalExpenseSplit['Parent 1'] / 100);
            p2Share = item.amount * (item.medicalExpenseSplit['Parent 2'] / 100);
          } else {
            p1Share = item.amount * (item.expenseSplit['Parent 1'] / 100);
            p2Share = item.amount * (item.expenseSplit['Parent 2'] / 100);
          }
          p1Paid = expense.paidBy === 'Parent 1' ? expense.amount : 0;
          p2Paid = expense.paidBy === 'Parent 2' ? expense.amount : 0;
        } else if (item.type === 'child_support') {
            if (item.paidBy === 'Parent 1') {
                p1Owes += item.amount;
            } else if (item.paidBy === 'Parent 2') {
                p2Owes += item.amount;
            }
            return; // Skip remaining calculation for child support
        }
        
        p1Owes += Math.max(0, p1Share - p1Paid);
        p2Owes += Math.max(0, p2Share - p2Paid);
     });

     return { totalAmount: amount, totalParent1Owes: p1Owes, totalParent2Owes: p2Owes };

  }, [allUnsettledItems]);

  const renderItemDetails = (item: UnsettledItem) => {
      let p1OwesAmount = 0;
      let p2OwesAmount = 0;
      
      if (item.type === 'expense') {
          const expense = item.originalExpense!;
          let p1Share = 0;
          let p2Share = 0;
          if (expense.category === 'Medical' || expense.category === 'Child Care') {
              p1Share = item.amount * (item.medicalExpenseSplit['Parent 1'] / 100);
              p2Share = item.amount * (item.medicalExpenseSplit['Parent 2'] / 100);
          } else {
              p1Share = item.amount * (item.expenseSplit['Parent 1'] / 100);
              p2Share = item.amount * (item.expenseSplit['Parent 2'] / 100);
          }

          const p1Paid = expense.paidBy === 'Parent 1' ? expense.amount : 0;
          const p2Paid = expense.paidBy === 'Parent 2' ? expense.amount : 0;
          
          p1OwesAmount = Math.max(0, p1Share - p1Paid);
          p2OwesAmount = Math.max(0, p2Share - p2Paid);

      } else if (item.type === 'child_support') {
          if (item.paidBy === 'Parent 1') { // Parent 1 is the payer
              p1OwesAmount = item.amount;
          } else if (item.paidBy === 'Parent 2') { // Parent 2 is the payer
              p2OwesAmount = item.amount;
          }
      }
      return { p1OwesAmount, p2OwesAmount };
  }


  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <ReceiptText className="h-5 w-5 text-secondary-foreground" />
          </span>
          <div>
            <CardTitle>All Unsettled Items</CardTitle>
            <CardDescription>
              A ledger of all outstanding expenses and payments. 
              The view is currently filtered; use the controls to adjust it.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center space-x-2 mb-4">
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-full sm:w-[120px] mb-2 sm:mb-0">
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

           <Select value={monthFilter} onValueChange={setMonthFilter} disabled={availableMonths.length === 0}>
            <SelectTrigger className="w-full sm:w-[180px] mb-2 sm:mb-0">
              <SelectValue placeholder="Filter by month" />
            </SelectTrigger>
            <SelectContent>
              {availableMonths.map(month => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={monthFilter === 'all' ? 'secondary' : 'outline'}
            onClick={() => setMonthFilter('all')}
            >
            Show All
          </Button>
          <div className="flex-grow" />
          <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                <div>
                  <Button variant="outline" size="icon" onClick={handleMarkAllSettled} disabled={allUnsettledItems.length === 0}>
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                </div>
                </TooltipTrigger>
                <TooltipContent>Mark All Settled</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto rounded-md border">
          <Table className="min-w-[1200px]">
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Paid By</TableHead>
                <TableHead className="w-[120px]">Settlement Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">{appData.months[Object.keys(appData.months)[0]].parentNames['Parent 1']} Owes</TableHead>
                <TableHead className="text-right">{appData.months[Object.keys(appData.months)[0]].parentNames['Parent 2']} Owes</TableHead>
                <TableHead className="w-[50px] no-print text-center">Receipt</TableHead>
                <TableHead className="w-[80px] no-print text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allUnsettledItems.length > 0 ? (
                allUnsettledItems.map((item) => {
                  const { p1OwesAmount, p2OwesAmount } = renderItemDetails(item);
                  const p1OwesMoney = p1OwesAmount > 0;
                  const p2OwesMoney = p2OwesAmount > 0;

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
                        {item.paidBy && item.paidBy !== 'None' && <Badge variant={item.paidBy === 'Parent 1' ? 'secondary' : 'outline'}>{item.parentNames[item.paidBy]}</Badge>}
                      </TableCell>
                       <TableCell>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`settle-switch-desktop-${item.id}`}
                            checked={false} // Always unsettled in this view
                            onCheckedChange={() => handleStatusToggle(item)}
                            aria-label={`Settle payment for ${item.description}`}
                          />
                          <Label htmlFor={`settle-switch-desktop-${item.id}`}>Unsettled</Label>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ${item.amount.toFixed(2)}
                      </TableCell>
                       <TableCell className={cn("text-right text-primary", p1OwesMoney && "text-destructive")}>
                        ${p1OwesAmount.toFixed(2)}
                      </TableCell>
                      <TableCell className={cn("text-right text-primary", p2OwesMoney && "text-destructive")}>
                        ${p2OwesAmount.toFixed(2)}
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
                  <TableCell colSpan={9} className="h-24 text-center">
                    {monthFilter === 'all'
                      ? `No unsettled items for ${yearFilter}.`
                      : `No unsettled items for ${format(parse(monthFilter, 'yyyy-MM', new Date()), 'MMMM yyyy')}.`}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
             {allUnsettledItems.length > 0 && (
                <TableFooter>
                    <TableRow className="bg-secondary/50 font-bold">
                    <TableCell colSpan={4}>Outstanding Totals</TableCell>
                    <TableCell className="text-right">
                        ${totalAmount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                        ${totalParent1Owes.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                        ${totalParent2Owes.toFixed(2)}
                    </TableCell>
                    <TableCell colSpan={2}></TableCell>
                    </TableRow>
                </TableFooter>
            )}
          </Table>
        </div>

        {/* Mobile Card View */}
        <div className="space-y-4 md:hidden">
            {allUnsettledItems.length > 0 ? (
                allUnsettledItems.map((item) => {
                    const { p1OwesAmount, p2OwesAmount } = renderItemDetails(item);
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
                                    <Badge variant={item.category === 'Child Support' ? 'default' : 'outline'}>{item.category}</Badge>
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
                                            id={`settle-switch-mobile-${item.id}`}
                                            checked={false}
                                            onCheckedChange={() => handleStatusToggle(item)}
                                            aria-label={`Settle payment for ${item.description}`}
                                        />
                                        <Label htmlFor={`settle-switch-mobile-${item.id}`}>Unsettled</Label>
                                    </div>
                                </div>
                            </div>
                            {(p1OwesAmount > 0 || p2OwesAmount > 0) && (
                                <div className="bg-muted/50 px-4 py-3 text-sm space-y-2">
                                    <p className="font-medium text-xs text-muted-foreground">Balance Details</p>
                                     <div className="flex justify-between">
                                        <span className="text-muted-foreground">{item.parentNames['Parent 1']} Owes</span>
                                        <span className={cn(p1OwesAmount > 0 && "text-destructive font-semibold")}>${p1OwesAmount.toFixed(2)}</span>
                                     </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">{item.parentNames['Parent 2']} Owes</span>
                                        <span className={cn(p2OwesAmount > 0 && "text-destructive font-semibold")}>${p2OwesAmount.toFixed(2)}</span>
                                     </div>
                                </div>
                            )}
                        </Card>
                    );
                })
            ) : (
                <div className="h-32 text-center flex flex-col justify-center items-center">
                    <p className="text-muted-foreground">
                        {monthFilter === 'all'
                        ? `No unsettled items for ${yearFilter}.`
                        : `No unsettled items for ${format(parse(monthFilter, 'yyyy-MM', new Date()), 'MMMM yyyy')}.`}
                    </p>
                </div>
            )}
        </div>

      </CardContent>
    </Card>
  );
}
