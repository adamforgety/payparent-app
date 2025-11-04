
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from './ui/carousel';
import { Users, FilePlus, Link2, ArrowRight, Settings, LayoutDashboard } from 'lucide-react';

interface GettingStartedDialogProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function GettingStartedDialog({ children, open, onOpenChange }: GettingStartedDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  
  const handleOpenChange = (isOpen: boolean) => {
    setInternalOpen(isOpen);
    onOpenChange?.(isOpen);
    // Mark as seen when closed
    if (!isOpen) {
      localStorage.setItem('hasSeenGettingStarted', 'true');
    }
  };

  const isControlled = open !== undefined && onOpenChange !== undefined;
  const dialogOpen = isControlled ? open : internalOpen;
  const dialogOnOpenChange = isControlled ? handleOpenChange : setInternalOpen;

  const tutorialSteps = [
    {
      icon: Settings,
      title: 'Step 1: Configure Your Settings',
      description: (
        <ul className="list-disc list-inside text-left text-sm text-muted-foreground space-y-2">
          <li>Go to the <strong>Settings</strong> tab to customize the app.</li>
          <li>Set parent names to personalize your dashboard.</li>
          <li>Enter the monthly child support amount.</li>
          <li>Adjust expense percentages for general and medical costs.</li>
          <li>Update your account email or password.</li>
        </ul>
      ),
      image: '/images/tutorial-step-1.png',
    },
    {
      icon: FilePlus,
      title: 'Step 2: Log Your First Expense',
      description: (
         <ul className="list-disc list-inside text-left text-sm text-muted-foreground space-y-2">
          <li>Click the big <strong>+</strong> button to add a single expense.</li>
          <li>Go to the <strong>Expenses</strong> tab to find the <strong>Monthly Ledger</strong>.</li>
          <li>Use the <strong>Import</strong> button to bulk upload expenses from a file and follow the instructions.</li>
        </ul>
      ),
      image: '/images/tutorial-step-2.png',
    },
    {
      icon: LayoutDashboard,
      title: 'Step 3: Understand the Dashboard',
      description: (
        <ul className="list-disc list-inside text-left text-sm text-muted-foreground space-y-2">
          <li>The <strong>Settle Balance</strong> card shows the final amount of who owes whom.</li>
          <li>The <strong>Balance Details</strong> card provides a complete breakdown of how that balance was calculated.</li>
        </ul>
      ),
      image: '/images/tutorial-step-3.png',
    },
    {
      icon: Link2,
      title: 'Step 4: Link With Your Co-Parent',
      description:
        'Head to Settings > Account to find your unique Co-Parent Code. Share it with your co-parent to link accounts and share financial data seamlessly.',
      image: '/images/tutorial-step-3.png',
    },
  ];

  return (
    <Dialog open={dialogOpen} onOpenChange={dialogOnOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg" hideCloseButton>
        <DialogHeader>
          <DialogTitle>Welcome to PayParent!</DialogTitle>
          <DialogDescription>
            Here’s a quick guide to get you started.
          </DialogDescription>
        </DialogHeader>
        <Carousel className="w-full px-12">
          <CarouselContent>
            {tutorialSteps.map((step, index) => (
              <CarouselItem key={index}>
                <div className="p-1">
                  <div className="text-center space-y-4 p-4">
                    <div className="flex justify-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <step.icon className="h-6 w-6" />
                        </div>
                    </div>
                    <h3 className="text-lg font-semibold">{step.title}</h3>
                    <div className="text-sm text-muted-foreground">
                      {step.description}
                    </div>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
        <DialogFooter className="sm:justify-between items-center">
            <p className="text-xs text-muted-foreground hidden sm:block">You can access this guide again from the account menu.</p>
            <Button onClick={() => dialogOnOpenChange(false)}>
                Got it!
                <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
