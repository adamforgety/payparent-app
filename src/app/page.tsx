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
  const { isNewUser } = useAppContext();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showGettingStarted, setShowGettingStarted] = useState(isNewUser);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    setShowGettingStarted(isNewUser);
  }, [isNewUser]);

  if (isUserLoading || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Connecting to your account...</p>
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
