
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2, Info } from 'lucide-react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, AuthErrorCodes } from 'firebase/auth';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { handleNewUser } from './actions';
import { Logo } from '@/components/logo';
import { useFirebase } from '@/firebase';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

const passwordResetSchema = z.object({
    email: z.string().email({ message: 'Please enter a valid email address.' }),
});


function getErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  if (error && typeof error.code === 'string') {
      switch (error.code) {
          case AuthErrorCodes.INVALID_EMAIL:
              return "The email address is not valid.";
          case AuthErrorCodes.USER_DISABLED:
              return "This user account has been disabled.";
          case AuthErrorCodes.USER_NOT_FOUND:
          case 'auth/wrong-password':
          case AuthErrorCodes.INVALID_LOGIN_CREDENTIALS:
              return "Invalid credentials. Please try again.";
          case AuthErrorCodes.EMAIL_EXISTS:
              return "An account with this email address already exists.";
          case AuthErrorCodes.WEAK_PASSWORD:
              return "The password is too weak. It must be at least 8 characters long.";
          case 'auth/popup-closed-by-user':
              return 'Sign-in process was cancelled.';
          default:
              return "An unexpected error occurred. Please try again.";
      }
  }
  return "An unknown error occurred.";
}

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isDemoPending, startDemoTransition] = useTransition();
  const [isResetPending, startResetTransition] = useTransition();
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isResetDialogOpen, setResetDialogOpen] = useState(false);
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/';
  const { auth } = useFirebase();

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const passwordResetForm = useForm<z.infer<typeof passwordResetSchema>>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: { email: '' },
  });

  const onLoginSubmit = (values: z.infer<typeof loginSchema>) => {
    startTransition(async () => {
      const { email, password } = values;
      
      try {
        await signInWithEmailAndPassword(auth, email, password);
        toast({ title: 'Login Successful', description: 'Welcome back!' });
        router.push(next);
        router.refresh();

      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Login Failed',
          description: getErrorMessage(error),
        });
      }
    });
  };

  const onDemoLogin = () => {
    startDemoTransition(async () => {
        const email = 'payparentdemo@gmail.com';
        const password = 'Demo#123';

        try {
            // First, try to sign in
            await signInWithEmailAndPassword(auth, email, password);
            toast({ title: 'Demo Login Successful', description: 'Welcome to the demo!' });
            router.push(next);
            router.refresh();
        } catch (error: any) {
            if (error.code === AuthErrorCodes.USER_NOT_FOUND) {
                // If user does not exist, create it
                try {
                    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                    const actionResult = await handleNewUser(userCredential.user.uid, userCredential.user.email);
                    if (actionResult.success) {
                        toast({ title: 'Demo Account Created', description: 'Welcome to the demo!' });
                        router.push(next);
                        router.refresh();
                    } else {
                        toast({ variant: 'destructive', title: 'Demo Setup Failed', description: actionResult.error });
                    }
                } catch (createError: any) {
                    toast({ variant: 'destructive', title: 'Demo Creation Failed', description: getErrorMessage(createError) });
                }
            } else {
                // Handle other login errors
                toast({ variant: 'destructive', title: 'Demo Login Failed', description: getErrorMessage(error) });
            }
        }
    });
  };

  const onPasswordResetSubmit = (values: z.infer<typeof passwordResetSchema>) => {
    startResetTransition(async () => {
        try {
            await sendPasswordResetEmail(auth, values.email);
            toast({
                title: 'Password Reset Email Sent',
                description: 'Check your inbox for a link to reset your password.',
            });
            setResetDialogOpen(false);
            passwordResetForm.reset();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Request Failed',
                description: getErrorMessage(error),
            });
        }
    });
  };


  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/50 p-4">
       <Card className="w-full max-w-md">
        <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
             <Logo />
            </div>
          <CardTitle className="text-2xl">Welcome</CardTitle>
          <CardDescription>Sign in to your account to continue</CardDescription>
        </CardHeader>
        <CardContent>
            <Alert className="mb-6">
                <Info className="h-4 w-4" />
                <AlertTitle>Account Creation is Not Available</AlertTitle>
                <AlertDescription>
                    We are not accepting new sign-ups at this time. Please use the demo account to explore the app.
                </AlertDescription>
            </Alert>
            <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                <FormField
                control={loginForm.control}
                name="email"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                        <Input 
                        placeholder="you@example.com" 
                        {...field}
                        />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                    <FormItem>
                    <div className="flex items-center justify-between">
                        <FormLabel>Password</FormLabel>
                            <Dialog open={isResetDialogOpen} onOpenChange={setResetDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="link" type="button" className="p-0 h-auto text-xs">
                                    Forgot password?
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Reset Password</DialogTitle>
                                    <DialogDescription>
                                        Enter your account's email address and we will send you a link to reset your password.
                                    </DialogDescription>
                                </DialogHeader>
                                <Form {...passwordResetForm}>
                                    <form onSubmit={passwordResetForm.handleSubmit(onPasswordResetSubmit)} className="space-y-4">
                                        <FormField
                                            control={passwordResetForm.control}
                                            name="email"
                                            render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Email</FormLabel>
                                                <FormControl>
                                                <Input placeholder="you@example.com" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                            )}
                                        />
                                        <DialogFooter>
                                            <Button type="submit" disabled={isResetPending}>
                                                {isResetPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Send Reset Link
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </Form>
                            </DialogContent>
                        </Dialog>
                    </div>
                    <FormControl>
                        <div className="relative">
                        <Input
                            type={showLoginPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            {...field}
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                            onClick={() => setShowLoginPassword(!showLoginPassword)}
                        >
                            {showLoginPassword ? (
                            <EyeOff className="h-4 w-4" />
                            ) : (
                            <Eye className="h-4 w-4" />
                            )}
                        </Button>
                        </div>
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <Button type="submit" className="w-full" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Login
                </Button>
            </form>
            </Form>
            <div className="my-4 flex items-center">
                <Separator className="flex-1" />
                <span className="mx-4 text-xs uppercase text-muted-foreground">Or</span>
                <Separator className="flex-1" />
            </div>
            <Button variant="outline" className="w-full" onClick={onDemoLogin} disabled={isDemoPending}>
                {isDemoPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Try a Demo
            </Button>
            <div className="mt-6 pt-4 border-t border-border flex items-center justify-center gap-3 text-xs text-muted-foreground">
              <Link href="/privacy" className="hover:underline hover:text-foreground">
                Privacy Policy
              </Link>
              <span>•</span>
              <Link href="/terms" className="hover:underline hover:text-foreground">
                Terms of Service
              </Link>
            </div>
        </CardContent>
      </Card>
    </main>
  );
}
