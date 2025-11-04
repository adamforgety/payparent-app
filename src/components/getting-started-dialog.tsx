
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
import { Users, FilePlus, Link2, ArrowRight } from 'lucide-react';
import { Separator } from './ui/separator';

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
      icon: Users,
      title: 'Step 1: Set Your Names',
      description:
        'Go to the Settings tab and customize the names for "Parent 1" and "Parent 2". This will make the app easier to use.',
      image: '/images/tutorial-step-1.png',
    },
    {
      icon: FilePlus,
      title: 'Step 2: Log Your First Expense',
      description:
        'Click the big "+" button in the bottom corner to add your first child-related expense. You can categorize it and specify who paid.',
      image: '/images/tutorial-step-2.png',
    },
    {
      icon: Link2,
      title: 'Step 3: Link With Your Co-Parent',
      description:
        'Head to Settings > Account to find your unique Co-Parent Code. Share it with your co-parent to link accounts and share financial data seamlessly.',
      image: '/images/tutorial-step-3.png',
    },
  ];

  return (
    <Dialog open={dialogOpen} onOpenChange={dialogOnOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-md" hideCloseButton>
        <DialogHeader>
          <DialogTitle>Welcome to PayParent!</DialogTitle>
          <DialogDescription>
            Here’s a quick guide to get you started.
          </DialogDescription>
        </DialogHeader>
        <Carousel className="w-full">
          <CarouselContent>
            {tutorialSteps.map((step, index) => (
              <CarouselItem key={index}>
                <div className="p-1">
                  <div className="flex aspect-square items-center justify-center p-6 flex-col gap-4 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <step.icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {step.description}
                    </p>
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
