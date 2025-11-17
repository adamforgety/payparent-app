
'use client';

import { AppContextProvider } from '@/context/app-context';
import { Dashboard } from '@/components/dashboard';
import { useFirebase } from '@/firebase';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { GettingStartedPage } from '@/components/getting-started-page';
import { useAppContext } from '@/context/app-context';

function AppContent() {
  const { user, isUserLoading } = useFirebase();
  const { isNewUser, isLoading: isAppContextLoading } = useAppContext();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showGettingStarted, setShowGettingStarted] = useState(false);

  useEffect(() => {
    // Redirect to login only after we are sure the user is not logged in and not loading.
    if (!isUserLoading && !isAppContextLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, isAppContextLoading, router]);

  useEffect(() => {
    // Show the getting started page if the context marks the user as new.
    setShowGettingStarted(isNewUser);
  }, [isNewUser]);

  // Show a loading indicator if either Firebase auth or the app context is loading.
  if (isUserLoading || isAppContextLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Connecting to your account...</p>
      </div>
    );
  }
  
  // If we are done loading and there's still no user, don't render the dashboard.
  if (!user) {
     return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }
  
  if (showGettingStarted) {
    return <GettingStartedPage onFinish={() => setShowGettingStarted(false)} />;
  }

  return (
      <Dashboard 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onShowGettingStarted={() => setShowGettingStarted(true)}
      />
  );
}

export default function Home() {
  return (
    <AppContextProvider>
      <AppContent />
    </AppContextProvider>
  );
}
