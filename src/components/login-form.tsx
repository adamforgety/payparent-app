'use client';

import { HandCoins, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Logo } from './logo';
import { useUser, useAuth } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';


export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    // If the user is already logged in, redirect them to the homepage.
    if (user) {
      router.push('/');
    }
  }, [user, router]);


  const handleAnonymousLogin = async () => {
    setIsLoading(true);
    try {
      initiateAnonymousSignIn(auth);
      // The onAuthStateChanged listener in FirebaseProvider will handle the redirect
      toast({
        title: 'Logging in...',
        description: 'You will be redirected shortly.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: error.message || 'An unexpected error occurred.',
      });
      setIsLoading(false);
    }
  };

  return (
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className='flex justify-center mb-4'>
              <Logo />
          </div>
          <CardTitle>Welcome to PayParent</CardTitle>
          <CardDescription>Click below to start managing your expenses securely.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
              <Button onClick={handleAnonymousLogin} disabled={isLoading || isUserLoading} className="w-full">
                {isLoading || isUserLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <HandCoins className='mr-2'/>}
                Enter Securely
              </Button>
          </div>
        </CardContent>
      </Card>
  );
}
