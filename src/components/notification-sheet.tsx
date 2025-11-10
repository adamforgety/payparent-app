
'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { type ReactNode, useMemo } from 'react';
import type { Expense, Notification } from '@/lib/types';
import { useAppContext } from '@/context/app-context';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from './ui/scroll-area';
import { Bell, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';

interface NotificationSheetProps {
  children: ReactNode;
}

export function NotificationSheet({ children }: NotificationSheetProps) {
  const { firestore, user } = useFirebase();
  const { appData } = useAppContext();

  const notificationsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'notifications'),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, user]);

  const { data: notifications, isLoading } = useCollection<Notification>(notificationsQuery);

  const allExpenses = useMemo(() => {
    if (!appData) return new Map<string, Expense>();
    const expenseMap = new Map<string, Expense>();
    Object.values(appData.months).forEach(month => {
      month.expenses.forEach(expense => {
        expenseMap.set(expense.id, expense);
      });
    });
    return expenseMap;
  }, [appData]);

  const activeNotifications = useMemo(() => {
    if (!notifications) return [];
    return notifications.filter(notif => {
      const expense = allExpenses.get(notif.expenseId);
      return expense && expense.status === 'Unsettled';
    });
  }, [notifications, allExpenses]);

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
            ) : activeNotifications.length > 0 ? (
                activeNotifications.map(notification => {
                    const expense = allExpenses.get(notification.expenseId);
                    return (
                        <div key={notification.id} className="flex items-start gap-3 rounded-lg border p-3">
                             <AlertCircle className="h-5 w-5 mt-1 text-primary flex-shrink-0" />
                            <div className="text-sm">
                                <p>{notification.message}</p>
                                {expense && (
                                     <p className="font-bold">${expense.amount.toFixed(2)}</p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                    {notification.createdAt
                                    ? formatDistanceToNow(notification.createdAt.toDate(), { addSuffix: true })
                                    : 'just now'}
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
