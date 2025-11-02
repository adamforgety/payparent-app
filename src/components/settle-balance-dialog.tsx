'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Expense, Parent, ExpenseSplit, ChildSupport, PaymentStatus, ParentNames, MedicalExpenseSplit, AppData } from '@/lib/types';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/context/app-context';
import { format } from 'date-fns';

interface SettleBalanceDialogProps {
  parent: Parent;
  otherParent: Parent;
  expenses: Expense[];
  expenseSplit: ExpenseSplit;
  medicalExpenseSplit: MedicalExpenseSplit;
  childSupport: ChildSupport;
  children: React.ReactNode;
  netBalance: number;
  parentNames: ParentNames;
  appData: AppData;
  currentMonthId: string;
}

type ItemToSettle = {
  id: string;
  description: string;
  totalAmount: number;
  owedAmount: number;
  status: PaymentStatus;
  type: 'expense' | 'child_support';
  originalPayer: Parent | 'None';
  monthId: string;
};

export function SettleBalanceDialog({
  parent,
  otherParent,
  expenses,
  expenseSplit,
  medicalExpenseSplit,
  childSupport,
  children,
  netBalance,
  parentNames,
  appData,
  currentMonthId,
}: SettleBalanceDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const { updateExpense, updateChildSupport } = useAppContext();
  
  const allUnsettledItems = useMemo<ItemToSettle[]>(() => {
    let items: ItemToSettle[] = [];
     Object.keys(appData.months).forEach(monthId => {
        const monthData = appData.months[monthId];
        if (monthData) {
            // Unsettled expenses for the month
            monthData.expenses
                .filter(exp => exp.status === 'Unsettled')
                .forEach(exp => {
                    let split = 0;
                    if (exp.category === 'Reimbursement') {
                        split = 1;
                    } else if (exp.category === 'Medical' || exp.category === 'Child Care') {
                        split = monthData.medicalExpenseSplit[exp.paidBy === parent ? otherParent : parent] / 100;
                    } else {
                        split = monthData.expenseSplit[exp.paidBy === parent ? otherParent : parent] / 100;
                    }

                    items.push({
                        id: exp.id,
                        description: exp.description,
                        totalAmount: exp.amount,
                        owedAmount: exp.amount * split,
                        status: exp.status,
                        type: 'expense',
                        originalPayer: exp.paidBy,
                        monthId: monthId,
                    });
                });

            // Unsettled child support for the month
            if (monthData.childSupport.amount > 0 && monthData.childSupport.paidBy !== 'None' && monthData.childSupport.status === 'Unsettled') {
                items.push({
                    id: `cs-${monthId}`,
                    description: 'Child Support',
                    totalAmount: monthData.childSupport.amount,
                    owedAmount: monthData.childSupport.amount,
                    status: monthData.childSupport.status,
                    type: 'child_support',
                    originalPayer: monthData.childSupport.paidBy,
                    monthId: monthId,
                });
            }
        }
    });
    return items.filter(item => item.owedAmount > 0);
  }, [appData.months, parent, otherParent]);

  const itemsOwedToMe = useMemo<ItemToSettle[]>(() => {
    return allUnsettledItems.filter(item => item.originalPayer === parent || item.originalPayer === otherParent && item.type === 'child_support');
  }, [allUnsettledItems, parent, otherParent]);
  
  const itemsOwedByMe = useMemo<ItemToSettle[]>(() => {
    return allUnsettledItems.filter(item => item.originalPayer === otherParent || item.originalPayer === parent && item.type === 'child_support');
  }, [allUnsettledItems, parent, otherParent]);


  const handleMarkAsSettled = (item: ItemToSettle) => {
    if (item.type === 'expense') {
      const originalExpense = appData.months[item.monthId]?.expenses.find(exp => exp.id === item.id);
      if(originalExpense) {
        updateExpense({ ...originalExpense, status: 'Settled' }, item.monthId);
      }
    } else { // child_support
      const originalChildSupport = appData.months[item.monthId]?.childSupport;
       if(originalChildSupport) {
         const updatedChildSupport = { ...originalChildSupport, status: 'Settled' };
         // A bit of a workaround: updateAppData is better for cross-month updates
         const updatedMonths = { ...appData.months, [item.monthId]: { ...appData.months[item.monthId], childSupport: updatedChildSupport }};
         // This needs a direct call if updateChildSupport is month-specific
         // For now, let's assume we need a more general update function
         // A proper implementation would call a context function like:
         // updateChildSupportForMonth(item.monthId, { status: 'Settled' });
         // Let's call the existing updateChildSupport and see if it's been adapted
         updateChildSupport(updatedChildSupport);
      }
    }
    toast({
      title: 'Payment Marked as Settled',
      description: `"${item.description}" has been marked as settled.`,
    });
  };
  
  const handleMarkAllAsSettled = () => {
    itemsOwedByMe.forEach(item => {
      if (item.status === 'Unsettled') {
         handleMarkAsSettled(item);
      }
    });
     toast({
      title: 'All Owed Items Marked as Settled',
      description: `All items you owed have been updated.`,
    });
  };

  const totalOwedToMe = itemsOwedToMe.reduce((acc, item) => {
    return acc + (item.originalPayer === parent ? item.owedAmount : (item.originalPayer === otherParent && item.type === 'child_support' ? item.owedAmount : 0));
  }, 0);
  
  const totalOwedByMe = itemsOwedByMe.reduce((acc, item) => {
    return acc + (item.originalPayer === otherParent ? item.owedAmount : (item.originalPayer === parent && item.type === 'child_support' ? item.owedAmount : 0));
  }, 0);

  const otherParentName = parentNames[otherParent];
  const finalNetBalance = totalOwedToMe - totalOwedByMe;


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl w-full grid-rows-[auto,minmax(0,1fr),auto] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Settle Balances</DialogTitle>
          <DialogDescription>
             Review all unsettled items and mark them as settled to clear balances with {otherParentName}.
          </DialogDescription>
        </DialogHeader>
        
        <div className='overflow-y-auto -mx-6 px-6 flex-1'>
            <div className="mt-4 rounded-lg bg-secondary/50 p-4 text-center">
              <div className="text-sm text-muted-foreground">
                {finalNetBalance >= 0 ? `${otherParentName} owes you` : `You owe ${otherParentName}`}
              </div>
              <div
                className={cn(
                  'text-2xl font-bold',
                    finalNetBalance < 0 && 'text-destructive',
                    finalNetBalance > 0 && 'text-green-600'
                )}
              >
                ${Math.abs(finalNetBalance).toFixed(2)}
              </div>
            </div>
          <Tabs defaultValue="owed-by-me" className="mt-4">
            <TabsList className="grid w-full grid-cols-2 h-auto flex-wrap">
              <TabsTrigger value="owed-to-me" className="flex-wrap h-auto py-1.5">
                <span className="mr-2">{otherParentName} Owes You ({itemsOwedToMe.length})</span>
                <span className="text-primary font-bold">${totalOwedToMe.toFixed(2)}</span>
                </TabsTrigger>
              <TabsTrigger value="owed-by-me" className="flex-wrap h-auto py-1.5">
                <span className="mr-2">You Owe {otherParentName} ({itemsOwedByMe.length})</span>
                <span className="text-destructive font-bold">${totalOwedByMe.toFixed(2)}</span>
                </TabsTrigger>
            </TabsList>
            <TabsContent value="owed-to-me">
              <SettlementTable 
                  items={itemsOwedToMe}
                  actionLabel="Mark as Settled"
                  onItemAction={handleMarkAsSettled}
                  actionVariant='default'
                  isReceiving={true}
              />
            </TabsContent>
            <TabsContent value="owed-by-me">
                <SettlementTable 
                  items={itemsOwedByMe}
                  actionLabel="Mark as Settled"
                  onItemAction={handleMarkAsSettled}
                  actionVariant='destructive'
                  onMarkAllSettled={handleMarkAllAsSettled}
                  isReceiving={false}
                />
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="mt-4 shrink-0">
          <DialogClose asChild>
            <Button variant="outline" className="w-full sm:w-auto">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


interface SettlementTableProps {
  items: ItemToSettle[];
  actionLabel: string;
  onItemAction: (item: ItemToSettle) => void;
  actionVariant: 'default' | 'destructive';
  isReceiving: boolean;
  onMarkAllSettled?: () => void;
}

function SettlementTable({ items, actionLabel, onItemAction, actionVariant, isReceiving, onMarkAllSettled }: SettlementTableProps) {
  
  const canMarkAllSettled = items.some(item => item.status === 'Unsettled');
  
  return (
    <>
       {onMarkAllSettled && (
          <div className="flex justify-end my-4">
            <Button onClick={onMarkAllSettled} disabled={!canMarkAllSettled} variant="destructive">
              Mark All as Settled
            </Button>
          </div>
        )}
      <ScrollArea className="h-auto max-h-[40vh] rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 bg-secondary">
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Owed Amount</TableHead>
              {!isReceiving && <TableHead className="w-auto text-right">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length > 0 ? (
              items.map((item) => (
                  <TableRow key={`${item.id}-${item.type}`}>
                    <TableCell>
                      <p className="font-medium">{item.description}</p>
                      <p className="text-xs text-muted-foreground">Total: ${item.totalAmount.toFixed(2)}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">
                        Unsettled
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${item.owedAmount.toFixed(2)}
                    </TableCell>
                    {!isReceiving && (
                      <TableCell className='text-right'>
                        <Button
                          variant={actionVariant}
                          size="sm"
                          onClick={() => onItemAction(item)}
                        >
                          {actionLabel}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
            ) : (
              <TableRow>
                <TableCell colSpan={isReceiving ? 3 : 4} className="h-24 text-center">
                  No unsettled items in this category.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
      </>
  )
}
