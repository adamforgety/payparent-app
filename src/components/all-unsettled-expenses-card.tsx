'use client';

import { format, isAfter, startOfMonth, parse, isBefore } from 'date-fns';
import { ReceiptText, Trash2, Paperclip } from 'lucide-react';
import { useMemo, useState } from 'react';

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

interface AllUnsettledExpensesCardProps {
  appData: AppData;
  onUpdateExpense: (expense: Expense, originalMonthId: string) => void;
  onUpdateChildSupport: (childSupport: ChildSupport, monthId: string) => void;
  onDeleteExpense: (expenseId: string, monthId: string) => void;
  currentDate: Date;
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
}: AllUnsettledExpensesCardProps) {
  const { toast } = useToast();
  const [showPriorMonthsOnly, setShowPriorMonthsOnly] = useState(false);

  const allUnsettledItems = useMemo<UnsettledItem[]>(() => {
    let items: UnsettledItem[] = [];
    if (!appData?.months) return items;

    const dashboardMonthDate = startOfMonth(currentDate);

    for (const monthId in appData.months) {
      const monthDate = parse(monthId, 'yyyy-MM', new Date());

      // If the filter is on, skip any month that is not before the dashboard's currently viewed month
      if (showPriorMonthsOnly && !isBefore(monthDate, dashboardMonthDate)) {
        continue;
      }
      
      const monthData = appData.months[monthId];
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
  }, [appData.months, showPriorMonthsOnly, currentDate]);
  
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

  const { totalAmount, totalParent1Share, totalParent2Share } = useMemo(() => {
     let amount = 0;
     let p1Share = 0;
     let p2Share = 0;

     allUnsettledItems.forEach(item => {
        amount += item.amount;
        
        let parent1ItemShare = 0;
        let parent2ItemShare = 0;

        if (item.type === 'expense') {
          const expense = item.originalExpense!;
          if (expense.category === 'Reimbursement') {
            if (expense.paidBy === 'Parent 1') {
              parent1ItemShare = expense.amount;
              parent2ItemShare = -expense.amount;
            } else {
              parent1ItemShare = -expense.amount;
              parent2ItemShare = expense.amount;
            }
          } else if (expense.category === 'Medical' || expense.category === 'Child Care') {
            parent1ItemShare = item.amount * (item.medicalExpenseSplit['Parent 1'] / 100);
            parent2ItemShare = item.amount * (item.medicalExpenseSplit['Parent 2'] / 100);
          } else {
            parent1ItemShare = item.amount * (item.expenseSplit['Parent 1'] / 100);
            parent2ItemShare = item.amount * (item.expenseSplit['Parent 2'] / 100);
          }
        } else if (item.type === 'child_support') {
            if (item.paidBy === 'Parent 1') {
                parent1ItemShare = item.amount;
            } else if (item.paidBy === 'Parent 2') {
                parent2ItemShare = item.amount;
            }
        }
        
        p1Share += parent1ItemShare;
        p2Share += parent2ItemShare;
     });

     return { totalAmount: amount, totalParent1Share: p1Share, totalParent2Share: p2Share };

  }, [allUnsettledItems]);

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
              A ledger of all outstanding expenses and child support payments across all months.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2 mb-4">
          <Switch
            id="past-due-only"
            checked={showPriorMonthsOnly}
            onCheckedChange={setShowPriorMonthsOnly}
          />
          <Label htmlFor="past-due-only">Show Prior Months Only</Label>
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
                <TableHead className="text-right">{appData.months[Object.keys(appData.months)[0]].parentNames['Parent 1']}'s Share</TableHead>
                <TableHead className="text-right">{appData.months[Object.keys(appData.months)[0]].parentNames['Parent 2']}'s Share</TableHead>
                <TableHead className="w-[50px] no-print text-center">Receipt</TableHead>
                <TableHead className="w-[80px] no-print text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allUnsettledItems.length > 0 ? (
                allUnsettledItems.map((item) => {
                  let parent1Share = 0;
                  let parent2Share = 0;

                  if (item.type === 'expense') {
                      const expense = item.originalExpense!;
                      if (expense.category === 'Reimbursement') {
                          if (expense.paidBy === 'Parent 1') {
                              parent1Share = expense.amount;
                              parent2Share = -expense.amount;
                          } else {
                              parent1Share = -expense.amount;
                              parent2Share = expense.amount;
                          }
                      } else if (expense.category === 'Medical' || expense.category === 'Child Care') {
                          parent1Share = item.amount * (item.medicalExpenseSplit['Parent 1'] / 100);
                          parent2Share = item.amount * (item.medicalExpenseSplit['Parent 2'] / 100);
                      } else {
                          parent1Share = item.amount * (item.expenseSplit['Parent 1'] / 100);
                          parent2Share = item.amount * (item.expenseSplit['Parent 2'] / 100);
                      }
                  } else if (item.type === 'child_support') {
                      if (item.paidBy === 'Parent 1') {
                          parent1Share = item.amount;
                      } else if (item.paidBy === 'Parent 2') {
                          parent2Share = item.amount;
                      }
                  }

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
                        {item.paidBy && item.paidBy !== 'None' && <Badge variant={item.paidBy === 'Parent 1' ? 'secondary' : 'outline'}>{item.parentNames[item.paidBy]}</Badge>}
                      </TableCell>
                       <TableCell>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`settle-switch-${item.id}`}
                            checked={false} // Always unsettled in this view
                            onCheckedChange={() => handleStatusToggle(item)}
                            aria-label={`Settle payment for ${item.description}`}
                          />
                          <Label htmlFor={`settle-switch-${item.id}`}>Unsettled</Label>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ${item.amount.toFixed(2)}
                      </TableCell>
                       <TableCell className="text-right text-green-600">
                        ${parent1Share >= 0 ? parent1Share.toFixed(2) : `(${Math.abs(parent1Share).toFixed(2)})`}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        ${parent2Share >= 0 ? parent2Share.toFixed(2) : `(${Math.abs(parent2Share).toFixed(2)})`}
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
                    All items are settled. Great job!
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
                        ${totalParent1Share.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                        ${totalParent2Share.toFixed(2)}
                    </TableCell>
                    <TableCell colSpan={2}></TableCell>
                    </TableRow>
                </TableFooter>
            )}
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
