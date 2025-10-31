'use client';

import { AppContextProvider } from '@/context/app-context';
import { Dashboard } from '@/components/dashboard';

export default function Home() {
  return (
    <AppContextProvider>
      <div className="min-h-screen bg-background text-foreground">
        <Dashboard />
      </div>
    </AppContextProvider>
  );
}
