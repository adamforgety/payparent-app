'use client';

import { AppContextProvider } from '@/context/app-context';
import { Dashboard } from '@/components/dashboard';
import { useFirebase } from '@/firebase';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

function App() {
  const { user, isUserLoading } = useFirebase();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) {
      // If loading is finished and there's no user, redirect to login
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  // While checking auth state or if there's no user yet, show a loader
  if (isUserLoading || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Connecting to your account...</p>
      </div>
    );
  }

  // If user is logged in, show the dashboard
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
