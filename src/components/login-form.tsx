'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { HandCoins, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Logo } from './logo';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';

const pinSchema = z.object({
  pin: z.string().min(4, 'PIN must be 4 digits').max(4, 'PIN must be 4 digits'),
});

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { login } = useAuth();
  const router = useRouter();

  const form = useForm<z.infer<typeof pinSchema>>({
    resolver: zodResolver(pinSchema),
    defaultValues: {
      pin: '',
    },
  });

  async function onSubmit(values: z.infer<typeof pinSchema>) {
    setIsLoading(true);
    const success = await login(values.pin);
    if (success) {
      toast({
        title: 'Login Successful',
        description: 'Welcome back!',
      });
      router.push('/');
    } else {
      toast({
        variant: 'destructive',
        title: 'Invalid PIN',
        description: 'The PIN you entered is incorrect. Please try again.',
      });
      form.reset();
    }
    setIsLoading(false);
  }

  return (
    <AlertDialog>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className='flex justify-center mb-4'>
              <Logo />
          </div>
          <CardTitle>Enter PIN</CardTitle>
          <CardDescription>Enter the shared 4-digit PIN to access the dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="pin"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••"
                        maxLength={4}
                        className="text-center text-2xl tracking-[1rem]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Login
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm">
            <AlertDialogTrigger asChild>
                <Button variant="link" className="p-0 h-auto">Forgot PIN?</Button>
            </AlertDialogTrigger>
          </div>
        </CardContent>
      </Card>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Forgot Your PIN?</AlertDialogTitle>
          <AlertDialogDescription>
            To reset your PIN, please contact support for assistance. We need to verify your identity to protect your account.
            <br /><br />
            Email us at: <a href="mailto:support@example.com" className="text-primary hover:underline">support@example.com</a>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction>Got it</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
