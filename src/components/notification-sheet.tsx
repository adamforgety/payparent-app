
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
import { type ReactNode, useMemo, useState, useEffect } from 'react';
import { useAppContext } from '@/context/app-context';
import { format, parseISO } from 'date-fns';
import { ScrollArea } from './ui/scroll-area';
import { Bell, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';

interface NotificationSheetProps {
  children: ReactNode;
  onGoToUnsettled: (monthId: string) => void;
}

export function NotificationSheet({ children, onGoToUnsettled }: NotificationSheetProps) {
  const { user } = useFirebase();
  const { appData, isLoading } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);

  const reimbursementRequests = useMemo(() => {
    if (!appData || !user) return [];

    return Object.entries(appData.months)
      .flatMap(([monthId, monthData]) =>
        monthData.expenses
          .filter(
            (expense) =>
              expense.category === 'Reimbursement' &&
              expense.status === 'Unsettled'
          )
          .map((expense) => ({ ...expense, monthId }))
      )
      .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
  }, [appData, user]);

  const handleNotificationClick = (monthId: string) => {
    setIsOpen(false); // Close the sheet
    onGoToUnsettled(monthId);
  };
  
  // This allows the sheet to be used as a dropdown item trigger
  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(true);
  };


  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
       <SheetTrigger asChild onClick={handleTriggerClick}>
        {children}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </SheetTitle>
          <SheetDescription>
            All unsettled reimbursement requests. Settling an expense will clear
            its notification.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-8rem)] mt-4 pr-4">
          <div className="space-y-4">
            {isLoading ? (
              <p>Loading notifications...</p>
            ) : reimbursementRequests.length > 0 ? (
              reimbursementRequests.map((expense) => {
                const monthData = appData!.months[expense.monthId];
                const payerName = monthData
                  ? monthData.parentNames[expense.paidBy]
                  : 'A parent';

                return (
                  <Button
                    key={expense.id}
                    variant="ghost"
                    className="flex items-start gap-3 rounded-lg border p-3 text-left w-full h-auto"
                    onClick={() => handleNotificationClick(expense.monthId)}
                  >
                    <AlertCircle className="h-5 w-5 mt-1 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm break-words whitespace-normal">
                        {payerName} requested a reimbursement for "
                        {expense.description}".
                      </p>
                      <p className="font-bold">${expense.amount.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(parseISO(expense.date), 'MMMM, yyyy')}
                      </p>
                    </div>
                  </Button>
                );
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
