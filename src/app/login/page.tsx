'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useState, useTransition, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, AuthErrorCodes, fetchSignInMethodsForEmail } from 'firebase/auth';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import type { UserDoc } from '@/lib/types';

const signupSchema = z
  .object({
    username: z.string().min(3, 'Username must be at least 3 characters.').max(20, 'Username must be 20 characters or less.').regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores.'),
    email: z.string().email({ message: 'Please enter a valid email address.' }),
    password: z.string().min(8, { message: 'Password must be at least 8 characters long.' }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ['confirmPassword'],
  });

const loginSchema = z.object({
  emailOrUsername: z.string().min(1, { message: 'Email or username is required.' }),
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

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isResetPending, startResetTransition] = useTransition();
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [isResetDialogOpen, setResetDialogOpen] = useState(false);
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/';
  const { auth, firestore } = useFirebase();

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { emailOrUsername: '', password: '' },
  });

  const signupForm = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
  });

  const passwordResetForm = useForm<z.infer<typeof passwordResetSchema>>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: { email: '' },
  });

  const findEmailByUsername = useCallback(async (username: string): Promise<string | null> => {
    if (!firestore) return null;
    try {
      const usersRef = collection(firestore, 'users');
      const q = query(usersRef, where('appData.username', '==', username), limit(1));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      const userDoc = querySnapshot.docs[0].data() as UserDoc;
      return userDoc.email;
    } catch (error) {
      console.error("Client-side error finding user by username:", error);
      return null;
    }
  }, [firestore]);


  const onLoginSubmit = (values: z.infer<typeof loginSchema>) => {
    startTransition(async () => {
      const { emailOrUsername, password } = values;
      
      try {
        let emailToLogin = emailOrUsername;
        
        if (!emailOrUsername.includes('@')) {
          const foundEmail = await findEmailByUsername(emailOrUsername);
          if (foundEmail) {
            emailToLogin = foundEmail;
          } else {
            loginForm.setError('emailOrUsername', {
              type: 'manual',
              message: 'Username not found.',
            });
            return;
          }
        }
        
        await signInWithEmailAndPassword(auth, emailToLogin, password);
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

  const onSignupSubmit = (values: z.infer<typeof signupSchema>) => {
    startTransition(async () => {
      try {
        const existingEmail = await findEmailByUsername(values.username);
        if (existingEmail) {
          signupForm.setError('username', {
            type: 'manual',
            message: 'This username is already taken.'
          });
          return;
        }
      
        const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        const actionResult = await handleNewUser(userCredential.user.uid, userCredential.user.email, values.username);
        
        if (actionResult.success) {
            toast({ title: 'Sign-up Successful', description: 'Welcome! You are now logged in.' });
            router.push(next);
            router.refresh();
        } else {
           toast({
            variant: 'destructive',
            title: 'Sign-up Failed',
            description: actionResult.error,
          });
        }

      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Sign-up Failed',
          description: getErrorMessage(error),
        });
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

  const handleLoginFieldBlur = async (event: React.FocusEvent<HTMLInputElement>) => {
    const value = event.target.value.trim();
    if (!value) return;

    if (value.includes('@')) {
      // It's an email, check if it exists
      try {
        const methods = await fetchSignInMethodsForEmail(auth, value);
        if (methods.length === 0) {
          loginForm.setError('emailOrUsername', { type: 'manual', message: 'Email address not found.' });
        } else {
          loginForm.clearErrors('emailOrUsername');
        }
      } catch (error) {
        // Firebase might throw an error for invalid email format, let resolver handle it or clear
        loginForm.clearErrors('emailOrUsername');
      }
    } else {
      // It's a username, check if it exists
      const email = await findEmailByUsername(value);
      if (!email) {
        loginForm.setError('emailOrUsername', { type: 'manual', message: 'Username not found.' });
      } else {
        loginForm.clearErrors('emailOrUsername');
      }
    }
  };


  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/50 p-4">
       <Card className="w-full max-w-md">
        <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
             <Logo />
            </div>
          <CardTitle className="text-2xl">Welcome</CardTitle>
          <CardDescription>Sign in or create an account to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4 mt-4">
                  <FormField
                    control={loginForm.control}
                    name="emailOrUsername"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email or Username</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="you@example.com or your_username" 
                            {...field}
                            onBlur={handleLoginFieldBlur} 
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
            </TabsContent>
            <TabsContent value="signup">
              <Form {...signupForm}>
                <form onSubmit={signupForm.handleSubmit(onSignupSubmit)} className="space-y-4 mt-4">
                   <FormField
                    control={signupForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input placeholder="your_username" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signupForm.control}
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
                  <FormField
                    control={signupForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showSignupPassword ? 'text' : 'password'}
                              placeholder="••••••••"
                              {...field}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                              onClick={() => setShowSignupPassword(!showSignupPassword)}
                            >
                              {showSignupPassword ? (
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
                  <FormField
                    control={signupForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                           <div className="relative">
                            <Input
                              type={showSignupPassword ? 'text' : 'password'}
                              placeholder="••••••••"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isPending}>
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Account
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}
