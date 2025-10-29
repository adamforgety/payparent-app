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
import type { Expense, Parent, ExpenseSplit, ChildSupport, PaymentStatus, ParentNames } from '@/lib/types';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface SettleBalanceDialogProps {
  parent: Parent;
  otherParent: Parent;
  expenses: Expense[];
  expenseSplit: ExpenseSplit;
  childSupport: ChildSupport;
  onUpdateExpense: (expense: Expense) => void;
  onUpdateChildSupport: (childSupport: ChildSupport) => void;
  children: React.ReactNode;
  netBalance: number;
  parentNames: ParentNames;
}

type ItemToSettle = {
  id: string;
  description: string;
  totalAmount: number;
  owedAmount: number;
  status: PaymentStatus;
  type: 'expense' | 'child_support';
  originalPayer: Parent | 'None';
};

export function SettleBalanceDialog({
  parent,
  otherParent,
  expenses,
  expenseSplit,
  childSupport,
  onUpdateExpense,
  onUpdateChildSupport,
  children,
  netBalance,
  parentNames,
}: SettleBalanceDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const parentSplit = expenseSplit[parent] / 100;
  const otherParentSplit = expenseSplit[otherParent] / 100;

  const itemsOwedToMe = useMemo<ItemToSettle[]>(() => {
    const expensesPaidByMe = expenses
      .filter((exp) => exp.paidBy === parent && exp.status === 'Unpaid')
      .map((exp): ItemToSettle => ({
        id: exp.id,
        description: exp.description,
        totalAmount: exp.amount,
        owedAmount: exp.amount * otherParentSplit,
        status: exp.status,
        type: 'expense',
        originalPayer: exp.paidBy
      }));

    const childSupportToMe: ItemToSettle[] = [];
    if (childSupport.paidBy === otherParent && childSupport.amount > 0 && childSupport.status === 'Unpaid') {
      childSupportToMe.push({
        id: 'child-support',
        description: 'Child Support',
        totalAmount: childSupport.amount,
        owedAmount: childSupport.amount,
        status: childSupport.status,
        type: 'child_support',
        originalPayer: otherParent,
      });
    }

    return [...expensesPaidByMe, ...childSupportToMe].filter(item => item.owedAmount > 0);
  }, [expenses, childSupport, parent, otherParent, otherParentSplit]);

  const itemsOwedByMe = useMemo<ItemToSettle[]>(() => {
    const expensesPaidByOther = expenses
      .filter((exp) => exp.paidBy === otherParent && exp.status === 'Unpaid')
      .map((exp): ItemToSettle => ({
        id: exp.id,
        description: exp.description,
        totalAmount: exp.amount,
        owedAmount: exp.amount * parentSplit,
        status: exp.status,
        type: 'expense',
        originalPayer: exp.paidBy,
      }));

    const childSupportFromMe: ItemToSettle[] = [];
    if (childSupport.paidBy === parent && childSupport.amount > 0 && childSupport.status === 'Unpaid') {
      childSupportFromMe.push({
        id: 'child-support',
        description: 'Child Support',
        totalAmount: childSupport.amount,
        owedAmount: childSupport.amount,
        status: childSupport.status,
        type: 'child_support',
        originalPayer: parent,
      });
    }

    return [...expensesPaidByOther, ...childSupportFromMe].filter(item => item.owedAmount > 0);
  }, [expenses, childSupport, parent, otherParent, parentSplit]);

  const handleMarkAsPaid = (item: ItemToSettle) => {
    if (item.type === 'expense') {
      const originalExpense = expenses.find(exp => exp.id === item.id);
      if(originalExpense) onUpdateExpense({ ...originalExpense, status: 'Paid' });
    } else {
      onUpdateChildSupport({ ...childSupport, status: 'Paid' });
    }
    toast({
      title: 'Payment Marked as Paid',
      description: `"${item.description}" has been marked as paid.`,
    });
  };
  
  const handleMarkAllAsPaid = () => {
    itemsOwedByMe.forEach(item => {
      if (item.status === 'Unpaid') {
        if (item.type === 'expense') {
          const originalExpense = expenses.find(exp => exp.id === item.id);
          if(originalExpense) onUpdateExpense({ ...originalExpense, status: 'Paid' });
        } else {
          onUpdateChildSupport({ ...childSupport, status: 'Paid' });
        }
      }
    });
     toast({
      title: 'All Owed Items Marked as Paid',
      description: `All items you owed have been updated.`,
    });
  };

  const totalOwedToMe = itemsOwedToMe.reduce((acc, item) => acc + item.owedAmount, 0);
  const totalOwedByMe = itemsOwedByMe.reduce((acc, item) => acc + item.owedAmount, 0);

  const otherParentName = parentNames[otherParent];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl w-full grid-rows-[auto,minmax(0,1fr),auto] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Settle Balances</DialogTitle>
          <DialogDescription>
             Review unpaid items and mark them as paid to settle the balance with {otherParentName}.
          </DialogDescription>
        </DialogHeader>
        
        <div className='overflow-y-auto -mx-6 px-6'>
            <div className="mt-4 rounded-lg bg-secondary/50 p-4 text-center">
              <div className="text-sm text-muted-foreground">
                {netBalance >= 0 ? `${otherParentName} owes you` : `You owe ${otherParentName}`}
              </div>
              <div
                className={cn(
                  'text-2xl font-bold',
                    netBalance < 0 && 'text-destructive',
                    netBalance > 0 && 'text-green-600'
                )}
              >
                ${Math.abs(netBalance).toFixed(2)}
              </div>
            </div>
          <Tabs defaultValue="owed-by-me" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="owed-to-me">
                Owed to You ({itemsOwedToMe.length})
                <span className="ml-2 text-primary font-bold">${totalOwedToMe.toFixed(2)}</span>
                </TabsTrigger>
              <TabsTrigger value="owed-by-me">
                Owed by You ({itemsOwedByMe.length})
                <span className="ml-2 text-destructive font-bold">${totalOwedByMe.toFixed(2)}</span>
                </TabsTrigger>
            </TabsList>
            <TabsContent value="owed-to-me">
              <SettlementTable 
                  items={itemsOwedToMe}
                  actionLabel="Mark as Paid"
                  onItemAction={handleMarkAsPaid}
                  actionVariant='default'
                  isReceiving={true}
              />
            </TabsContent>
            <TabsContent value="owed-by-me">
                <SettlementTable 
                  items={itemsOwedByMe}
                  actionLabel="Mark as Paid"
                  onItemAction={handleMarkAsPaid}
                  actionVariant='destructive'
                  onMarkAllPaid={handleMarkAllAsPaid}
                  isReceiving={false}
                />
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="mt-4">
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
  onMarkAllPaid?: () => void;
}

function SettlementTable({ items, actionLabel, onItemAction, actionVariant, isReceiving, onMarkAllPaid }: SettlementTableProps) {
  
  const canMarkAllPaid = items.some(item => item.status === 'Unpaid');
  
  return (
    <>
       {onMarkAllPaid && (
          <div className="flex justify-end my-4">
            <Button onClick={onMarkAllPaid} disabled={!canMarkAllPaid} variant="destructive">
              Mark All as Paid
            </Button>
          </div>
        )}
      <ScrollArea className="h-[40vh] rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 bg-secondary">
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Owed Amount</TableHead>
              {!isReceiving && <TableHead className="w-[120px]">Action</TableHead>}
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
                        Unpaid
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${item.owedAmount.toFixed(2)}
                    </TableCell>
                    {!isReceiving && (
                      <TableCell>
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
                  No unpaid items in this category.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
      </>
  )
}
