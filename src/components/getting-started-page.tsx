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
import { Settings, FilePlus, LayoutDashboard, Link2, ArrowRight, Plus } from 'lucide-react';
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
          <li>Go to the <strong className="text-primary">Settings</strong> tab to customize the app.</li>
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
          <li>Click the <div className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground"><Plus className="w-3 h-3" /></div> button to add a single expense.</li>
          <li>Go to the <strong>Expenses</strong> tab to log, view, and settle expenses.</li>
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
          <li>The <strong>Balance Details</strong> card provides a complete balance breakdown.</li>
        </ul>
      ),
    },
    {
      icon: Link2,
      title: 'Step 4: Link With Your Co-Parent',
      description: (
        <p className="text-sm text-muted-foreground">
          Head to <strong className="text-primary">Settings</strong> &gt; <strong className="text-primary">Account</strong> to find your unique <strong className="text-primary">Co-Parent Code</strong>. Share it with your co-parent to link accounts and share financial data seamlessly.
        </p>
      )
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
