'use client';

import { LogOut, User as UserIcon } from 'lucide-react';
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

interface PageHeaderProps {
  totalExpenses: number;
}

export function PageHeader({ totalExpenses }: PageHeaderProps) {
  const auth = useAuth();
  const { user } = useFirebase();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const getInitials = (email: string | null | undefined) => {
    if (!email) return null;
    return email[0].toUpperCase();
  };

  return (
    <header className="no-print sticky top-0 z-10 border-b bg-background/80 p-4 backdrop-blur-sm">
      <div className="container mx-auto flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-4">
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
