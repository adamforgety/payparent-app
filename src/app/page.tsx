'use client';

import { AppContextProvider } from '@/context/app-context';
import { Dashboard } from '@/components/dashboard';
import { useAuth, useFirebase } from '@/firebase';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { signInAnonymously } from 'firebase/auth';

function App() {
  const { user, isUserLoading } = useFirebase();
  const auth = useAuth();

  useEffect(() => {
    if (!user && !isUserLoading) {
      signInAnonymously(auth);
    }
  }, [user, isUserLoading, auth]);

  if (isUserLoading || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Connecting to your account...</p>
      </div>
    );
  }

  return (
    <AppContextProvider>
      <div className="min-h-screen bg-background text-foreground">
        <Dashboard />
      </div>
    </AppContextProvider>
  );
}

export default function Home() {
  return <App />;
}
