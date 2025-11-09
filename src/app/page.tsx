'use client';

import { AppContextProvider } from '@/context/app-context';
import { Dashboard } from '@/components/dashboard';
import { useFirebase } from '@/firebase';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/page-header';

function App() {
  const { user, isUserLoading } = useFirebase();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

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
        <Dashboard activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </AppContextProvider>
  );
}

export default function Home() {
  return <App />;
}
