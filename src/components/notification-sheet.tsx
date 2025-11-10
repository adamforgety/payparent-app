
'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useFirebase } from '@/firebase';
import { type ReactNode, useMemo } from 'react';
import type { Expense, UserDoc } from '@/lib/types';
import { useAppContext } from '@/context/app-context';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ScrollArea } from './ui/scroll-area';
import { Bell, AlertCircle } from 'lucide-react';

interface NotificationSheetProps {
  children: ReactNode;
}

export function NotificationSheet({ children }: NotificationSheetProps) {
  const { user } = useFirebase();
  const { appData, coParentData, isLoading } = useAppContext();

  const currentUserParentLabel = useMemo(() => {
    if (!user || !appData || !coParentData) return null;
    
    // Find which parent the current user is. This is a bit tricky with shared data.
    // We assume the non-co-parent is the current user if names are customized.
    // This logic might need refinement based on how parent labels are assigned.
    const monthData = Object.values(appData.months)[0];
    if (!monthData) return null;

    if (monthData.parentNames['Parent 1'] === user.email) return 'Parent 1';
    if (monthData.parentNames['Parent 2'] === user.email) return 'Parent 2';
    
    // Fallback if emails don't match names (e.g. names are nicknames)
    // This is less reliable. A better approach would be to store user UIDs against Parent 1/2.
    // For now, we'll make a simple assumption.
    return 'Parent 1'; // Default assumption

  }, [user, appData, coParentData]);

  const reimbursementRequests = useMemo(() => {
    if (!appData || !currentUserParentLabel) return [];
    
    const otherParent = currentUserParentLabel === 'Parent 1' ? 'Parent 2' : 'Parent 1';

    const allExpenses = Object.values(appData.months).flatMap(month => month.expenses);

    return allExpenses.filter(expense => 
      (expense.category === 'Reimbursement' || expense.category === 'Credit') &&
      expense.status === 'Unsettled' &&
      expense.paidBy === otherParent
    ).sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
  }, [appData, currentUserParentLabel]);
  
  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </SheetTitle>
          <SheetDescription>
            Reimbursement requests from your co-parent. Settling the expense will clear the notification.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-8rem)] mt-4 pr-4">
            <div className="space-y-4">
            {isLoading ? (
                <p>Loading notifications...</p>
            ) : reimbursementRequests.length > 0 ? (
                reimbursementRequests.map(expense => {
                    const monthData = Object.values(appData!.months).find(m => m.expenses.some(e => e.id === expense.id));
                    const payerName = monthData ? monthData.parentNames[expense.paidBy] : 'Your co-parent';

                    return (
                        <div key={expense.id} className="flex items-start gap-3 rounded-lg border p-3">
                             <AlertCircle className="h-5 w-5 mt-1 text-primary flex-shrink-0" />
                            <div className="text-sm">
                                <p>{payerName} requested a reimbursement for "{expense.description}".</p>
                                <p className="font-bold">${expense.amount.toFixed(2)}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {formatDistanceToNow(parseISO(expense.date), { addSuffix: true })}
                                </p>
                            </div>
                        </div>
                    )
                })
            ) : (
                <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
                    <Bell className="h-8 w-8 mb-2" />
                    <p>No new notifications</p>
                </div>
            )}
            </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
