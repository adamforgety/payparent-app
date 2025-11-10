
'use client';

import { LogOut, User as UserIcon, HelpCircle, Bell } from 'lucide-react';
import { signOut } from 'firebase/auth';

import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { useAuth, useFirebase } from '@/firebase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Avatar, AvatarFallback } from './ui/avatar';
import { useRouter } from 'next/navigation';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { NotificationSheet } from './notification-sheet';
import { useAppContext } from '@/context/app-context';
import type { Expense, UserDoc } from '@/lib/types';
import { useMemo } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface PageHeaderProps {
  totalExpenses: number;
  onShowGettingStarted: () => void;
  onGoToUnsettled: (monthId: string) => void;
  onGoHome: () => void;
}

export function PageHeader({ totalExpenses, onShowGettingStarted, onGoToUnsettled, onGoHome }: PageHeaderProps) {
  const auth = useAuth();
  const { user } = useFirebase();
  const { appData } = useAppContext();
  const router = useRouter();
  const isMobile = useIsMobile();

  const handleSignOut = () => {
    signOut(auth).then(() => {
      router.push('/login');
    });
  };

  const getInitials = (email: string | null | undefined) => {
    if (!email) return null;
    return email[0].toUpperCase();
  };

  const hasNotifications = useMemo(() => {
    if (!appData || !user) return false;

    // Show badge if there are ANY unsettled reimbursements
    return Object.values(appData.months).some(month =>
      month.expenses.some(expense =>
        expense.category === 'Reimbursement' &&
        expense.status === 'Unsettled'
      )
    );
  }, [appData, user]);


  return (
    <header className="no-print sticky top-0 z-10 border-b bg-background/80 p-4 backdrop-blur-sm">
      <div className="container mx-auto flex items-center justify-between">
        <Button variant="link" className="p-0 h-auto" onClick={onGoHome}>
          <Logo />
        </Button>
        <div className="flex items-center gap-2">
          {!isMobile && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className="rounded-full" onClick={onShowGettingStarted}>
                      <HelpCircle className="h-5 w-5 text-primary" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Getting Started Guide</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {user && (
                <NotificationSheet onGoToUnsettled={onGoToUnsettled}>
                  <Button variant="outline" size="icon" className="rounded-full relative">
                    <Bell className="h-5 w-5 text-primary" />
                    {hasNotifications && (
                      <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
                    )}
                  </Button>
                </NotificationSheet>
              )}
            </>
          )}

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full">
                  <Avatar>
                    <AvatarFallback>
                      {getInitials(user.email) ?? <UserIcon className='h-5 w-5' />}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <p>My Account</p>
                  <p className='text-xs text-muted-foreground font-normal'>{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isMobile && (
                  <>
                     <NotificationSheet onGoToUnsettled={onGoToUnsettled}>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <Bell className="mr-2 h-4 w-4" />
                            <span>Notifications</span>
                             {hasNotifications && (
                                <span className="ml-auto block h-2 w-2 rounded-full bg-destructive" />
                            )}
                        </DropdownMenuItem>
                    </NotificationSheet>
                    <DropdownMenuItem onClick={onShowGettingStarted}>
                      <HelpCircle className="mr-2 h-4 w-4" />
                      <span>Getting Started</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
