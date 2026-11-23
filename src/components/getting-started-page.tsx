'use client';

import { Button } from './ui/button';
import { Play } from 'lucide-react';
import { Logo } from './logo';
import { useAppContext } from '@/context/app-context';

interface GettingStartedPageProps {
  onFinish: () => void;
}

export function GettingStartedPage({ onFinish }: GettingStartedPageProps) {
  const { setRunTour } = useAppContext();

  const handleStartTour = () => {
    onFinish(); // Close the getting started page
    setTimeout(() => {
        setRunTour(true); // Start the joyride tour
    }, 500); // Small delay to let the dashboard render
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg text-center space-y-8">
        <header className="space-y-4">
            <div className="flex justify-center">
                <Logo />
            </div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome to PayParent!</h1>
          <p className="text-lg text-muted-foreground">
            The easiest way to track, split, and settle shared expenses with your co-parent.
          </p>
        </header>

        <div className="bg-secondary/50 rounded-lg p-6 border text-left space-y-4">
            <h2 className="font-semibold text-lg">In this quick tour, you will learn how to:</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Configure your account settings and display names.</li>
                <li>Set your recurring monthly child support.</li>
                <li>Log new expenses and bulk-import spreadsheets.</li>
                <li>Navigate your dashboard and reports.</li>
            </ul>
        </div>

        <footer className="pt-4 flex flex-col gap-4 items-center">
            <Button size="lg" className="w-full sm:w-auto text-lg px-8" onClick={handleStartTour}>
                <Play className="mr-2 h-5 w-5" />
                Start Interactive Tour
            </Button>
            <Button variant="ghost" onClick={onFinish}>
                Skip for now
            </Button>
        </footer>
      </div>
    </div>
  );
}
