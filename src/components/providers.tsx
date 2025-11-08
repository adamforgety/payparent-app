'use client';

import { FirebaseClientProvider } from '@/firebase';
import { Toaster } from '@/components/ui/toaster';
import { AddToHomeScreenPrompt } from '@/components/add-to-home-screen-prompt';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseClientProvider>
      {children}
      <Toaster />
      <AddToHomeScreenPrompt />
    </FirebaseClientProvider>
  );
}
