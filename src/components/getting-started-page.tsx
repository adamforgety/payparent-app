'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from './ui/carousel';
import { Settings, FilePlus, LayoutDashboard, Link2, ArrowRight } from 'lucide-react';
import { Logo } from './logo';

interface GettingStartedPageProps {
  onFinish: () => void;
}

export function GettingStartedPage({ onFinish }: GettingStartedPageProps) {
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
    },
    {
      icon: FilePlus,
      title: 'Step 2: Log Your First Expense',
      description: (
        <ul className="list-disc list-inside text-left text-sm text-muted-foreground space-y-2">
          <li>Click the round <strong>+</strong> button to add a single expense.</li>
          <li>Go to the <strong>Expenses</strong> tab to log expenses, view all logged expenses and settle expenses.</li>
          <li>Use the <strong>Import</strong> button to bulk upload expenses from a file and follow the instructions.</li>
        </ul>
      ),
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
    },
    {
      icon: Link2,
      title: 'Step 4: Link With Your Co-Parent',
      description:
        'Head to Settings > Account to find your unique Co-Parent Code. Share it with your co-parent to link accounts and share financial data seamlessly.',
    },
  ];

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl">
        <header className="text-center mb-8">
            <div className="flex justify-center mb-4">
                <Logo />
            </div>
          <h1 className="text-2xl font-semibold">Welcome to PayParent!</h1>
          <p className="text-muted-foreground">
            Here’s a quick guide to get you started.
          </p>
        </header>

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
          <CarouselPrevious className="bg-primary text-primary-foreground hover:bg-primary/90" />
          <CarouselNext className="bg-primary text-primary-foreground hover:bg-primary/90" />
        </Carousel>

        <footer className="mt-8 flex justify-center">
            <Button onClick={onFinish}>
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
        </footer>
      </div>
    </div>
  );
}
