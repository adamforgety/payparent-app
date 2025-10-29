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
  const parentSplit = expenseSplit[parent] / 100;
  const otherParentSplit = expenseSplit[otherParent] / 100;

  const itemsOwedToMe = useMemo<ItemToSettle[]>(() => {
    const unsettledExpensesPaidByMe = expenses
      .filter((exp) => exp.paidBy === parent && exp.status !== 'Paid')
      .map((exp): ItemToSettle => ({
        id: exp.id,
        description: exp.description,
        totalAmount: exp.amount,
        owedAmount: exp.amount * otherParentSplit,
        status: exp.status,
        type: 'expense',
      }));

    const childSupportOwedToMe: ItemToSettle[] = [];
    if (childSupport.paidBy === otherParent && childSupport.amount > 0 && childSupport.status !== 'Paid') {
      childSupportOwedToMe.push({
        id: 'child-support',
        description: 'Child Support',
        totalAmount: childSupport.amount,
        owedAmount: childSupport.amount,
        status: childSupport.status,
        type: 'child_support',
      });
    }

    return [...unsettledExpensesPaidByMe, ...childSupportOwedToMe].filter(item => item.owedAmount > 0);
  }, [expenses, childSupport, parent, otherParentSplit, otherParent]);

  const itemsOwedByMe = useMemo<ItemToSettle[]>(() => {
    const unsettledExpensesPaidByOther = expenses
      .filter((exp) => exp.paidBy === otherParent && exp.status !== 'Paid')
      .map((exp): ItemToSettle => ({
        id: exp.id,
        description: exp.description,
        totalAmount: exp.amount,
        owedAmount: exp.amount * parentSplit,
        status: exp.status,
        type: 'expense',
      }));

    const childSupportOwedByMe: ItemToSettle[] = [];
    if (childSupport.paidBy === parent && childSupport.amount > 0 && childSupport.status !== 'Paid') {
      childSupportOwedByMe.push({
        id: 'child-support',
        description: 'Child Support',
        totalAmount: childSupport.amount,
        owedAmount: childSupport.amount,
        status: childSupport.status,
        type: 'child_support',
      });
    }

    return [...unsettledExpensesPaidByOther, ...childSupportOwedByMe].filter(item => item.owedAmount > 0);
  }, [expenses, childSupport, parent, parentSplit, otherParent]);


  const handleMarkAsPaid = (item: ItemToSettle) => {
    if (item.type === 'expense') {
      const originalExpense = expenses.find(exp => exp.id === item.id);
      if(originalExpense) onUpdateExpense({ ...originalExpense, status: 'Pending' });
    } else {
      onUpdateChildSupport({ ...childSupport, status: 'Pending' });
    }
  };
  
  const handleMarkAllAsPaid = () => {
    itemsOwedByMe.forEach(item => {
      if (item.status === 'Unpaid') {
        handleMarkAsPaid(item);
      }
    });
  };

  const handleMarkAsReceived = (item: ItemToSettle) => {
     if (item.type === 'expense') {
      const originalExpense = expenses.find(exp => exp.id === item.id);
      if(originalExpense) onUpdateExpense({ ...originalExpense, status: 'Paid' });
    } else {
      onUpdateChildSupport({ ...childSupport, status: 'Paid' });
    }
  }

  const totalOwedToMe = itemsOwedToMe.reduce((acc, item) => acc + item.owedAmount, 0);
  const totalOwedByMe = itemsOwedByMe.reduce((acc, item) => acc + item.owedAmount, 0);

  const otherParentName = parentNames[otherParent];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-full w-full sm:max-w-3xl" hideCloseButton>
        <DialogHeader>
          <DialogTitle>Settle Balances</DialogTitle>
          <DialogDescription asChild>
            <div>
              Manage payments between you and {otherParentName}. Mark items as paid or confirm receipt of payments.
            </div>
          </DialogDescription>
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
        </DialogHeader>
        <Tabs defaultValue="owed-to-me">
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
                actionLabel="Received"
                onItemAction={handleMarkAsReceived}
                actionVariant='default'
                actionDisabled={item => item.status === 'Unpaid' || item.status === 'Paid'}
                parent={parent}
             />
          </TabsContent>
          <TabsContent value="owed-by-me">
              <SettlementTable 
                items={itemsOwedByMe}
                actionLabel="Paid"
                onItemAction={handleMarkAsPaid}
                actionVariant='destructive'
                actionDisabled={item => item.status === 'Pending' || item.status === 'Paid'}
                parent={parent}
                onMarkAllPaid={handleMarkAllAsPaid}
              />
          </TabsContent>
        </Tabs>
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
  actionDisabled: (item: ItemToSettle) => boolean;
  parent: Parent;
  onMarkAllPaid?: () => void;
}

function SettlementTable({ items, actionLabel, onItemAction, actionVariant, actionDisabled, onMarkAllPaid }: SettlementTableProps) {
  
  const getStatus = (item: ItemToSettle) => {
    if(item.status === 'Pending' && actionLabel === 'Paid') return { text: 'Pending Confirmation', variant: 'secondary' as const, style: 'bg-yellow-500 hover:bg-yellow-600 text-black' };
    if(item.status === 'Pending' && actionLabel === 'Received') return { text: 'Confirmation Required', variant: 'secondary' as const, style: 'bg-yellow-500 hover:bg-yellow-600 text-black' };
    if(item.status === 'Unpaid') return { text: 'Unpaid', variant: 'destructive' as const, style: '' };
    return { text: 'Paid', variant: 'default' as const, style: 'bg-green-600 hover:bg-green-700' };
  }

  const canMarkAllPaid = items.some(item => item.status === 'Unpaid');
  
  return (
    <>
       {onMarkAllPaid && (
          <div className="flex justify-end mt-4">
            <Button onClick={onMarkAllPaid} disabled={!canMarkAllPaid} variant="destructive">
              Mark All as Paid
            </Button>
          </div>
        )}
      <ScrollArea className="h-[300px] sm:h-[400px] border rounded-md mt-2">
        <Table>
          <TableHeader className="sticky top-0 bg-secondary">
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Owed Amount</TableHead>
              <TableHead className="w-[100px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length > 0 ? (
              items.map((item) => {
                const status = getStatus(item);
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="font-medium">{item.description}</p>
                      <p className="text-xs text-muted-foreground">Total: ${item.totalAmount.toFixed(2)}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant} className={cn(status.style)}>
                        {status.text}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${item.owedAmount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                       <Button
                        variant={actionVariant}
                        size="sm"
                        onClick={() => onItemAction(item)}
                        disabled={actionDisabled(item)}
                      >
                        Mark as {actionLabel}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  No items in this category.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
      </>
  )
}
