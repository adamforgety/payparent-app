'use client';

import { Dashboard } from '@/components/dashboard';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    // Redirect to login if auth check is done and there's no user.
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  // Show a loading state while Firebase is checking the auth status.
  if (isUserLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  // If there's a user, show the dashboard.
  if (user) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Dashboard />
      </div>
    );
  }

  // If no user and not loading, this will soon redirect, but we can show nothing or a message.
  return null;
}
