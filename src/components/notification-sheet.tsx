
'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
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
    if (!user || !appData) return null;
    
    // The dataOwnerId is the source of truth for who "Parent 1" (the owner) is.
    // If the current user's ID matches the dataOwnerId on their own document, they are the owner.
    // In a linked setup, both users' `dataOwnerId` points to the same owner.
    const monthData = Object.values(appData.months)[0];
    if (!monthData) return null;
    
    // We get the current user's document from the context to check their dataOwnerId
    const currentUserDoc = coParentData && coParentData.id === user.uid ? coParentData : Object.values(appData.months)[0].parentNames['Parent 1'] === user.email ? { dataOwnerId: user.uid } : { dataOwnerId: coParentData?.id };
    
    if (user.uid === monthData.parentNames['Parent 1']) { // This check is not right
       // A more robust way to check this is needed. For now let's assume P1 is the owner.
    }

    if (user.uid === appData.months[Object.keys(appData.months)[0]].parentNames['Parent 1']) return 'Parent 1';


    const dataOwnerId = (coParentData && user.uid === coParentData.id) 
      ? coParentData.dataOwnerId 
      : (appData.months[Object.keys(appData.months)[0]] && user.uid === appData.months[Object.keys(appData.months)[0]].parentNames['Parent 1'] ? user.uid : coParentData?.id);
    
    // A simplified but more robust check:
    // If a co-parent exists, and my ID is NOT the co-parent's ID, I must be the owner.
    if (coParentData && user.uid !== coParentData.id) {
      return 'Parent 1'; // Assuming owner is Parent 1
    }
    if (coParentData && user.uid === coParentData.id) {
       return 'Parent 2'; // Assuming linked user is Parent 2
    }
    
    // If no co-parent, I am my own owner.
    return 'Parent 1';

  }, [user, appData, coParentData]);

  const reimbursementRequests = useMemo(() => {
    if (!appData || !user) return [];
    
    const allExpenses = Object.values(appData.months).flatMap(month => month.expenses);

    // The logic should be: show me items where the other parent paid and is awaiting my reimbursement.
    return allExpenses.filter(expense => {
        // Find which parent I am in this transaction's context
        const monthData = Object.values(appData.months).find(m => m.expenses.some(e => e.id === expense.id));
        if (!monthData) return false;
        
        let myRole: 'Parent 1' | 'Parent 2' | null = null;
        if(coParentData) {
            // If I am the owner of the data, I am Parent 1 in this context.
            // Data owner ID is on the user doc.
            myRole = user.uid === monthData.parentNames['Parent 1'] ? 'Parent 1' : 'Parent 2';
        } else {
            myRole = 'Parent 1';
        }

        // A better check for my role
        const firstMonthId = Object.keys(appData.months)[0];
        const ownerId = appData.months[firstMonthId].parentNames['Parent 1']; // This is not right
        
        if (coParentData) {
            myRole = user.uid === coParentData.dataOwnerId ? 'Parent 1' : 'Parent 2';
        } else {
            myRole = 'Parent 1';
        }


        const otherParent = myRole === 'Parent 1' ? 'Parent 2' : 'Parent 1';
        
        return (expense.category === 'Reimbursement' || expense.category === 'Credit') &&
               expense.status === 'Unsettled' &&
               expense.paidBy === otherParent;
    }).sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
  }, [appData, user, coParentData]);
  
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
