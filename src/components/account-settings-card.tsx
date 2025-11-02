'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useState, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2, KeyRound } from 'lucide-react';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword,
  AuthErrorCodes,
} from 'firebase/auth';

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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useFirebase } from '@/firebase';
import { Separator } from './ui/separator';

const emailSchema = z.object({
  newEmail: z.string().email({ message: 'Please enter a valid new email address.' }),
  password: z.string().min(1, { message: 'Password is required to change email.' }),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: 'Current password is required.' }),
    newPassword: z.string().min(8, { message: 'New password must be at least 8 characters long.' }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New passwords don't match.",
    path: ['confirmPassword'],
  });

function getFirebaseAuthErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  if (error && typeof error.code === 'string') {
    switch (error.code) {
      case AuthErrorCodes.INVALID_EMAIL:
        return 'The new email address is not valid.';
      case AuthErrorCodes.EMAIL_EXISTS:
        return 'This email address is already in use by another account.';
      case AuthErrorCodes.INVALID_LOGIN_CREDENTIALS:
        return 'The current password you entered is incorrect.';
      case AuthErrorCodes.WEAK_PASSWORD:
        return 'The new password is too weak. It must be at least 8 characters long.';
      case AuthErrorCodes.TOO_MANY_ATTEMPTS_TRY_LATER:
        return 'Too many attempts. Please try again later.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }
  return 'An unknown error occurred.';
}

export function AccountSettingsCard() {
  const { auth, user } = useFirebase();
  const { toast } = useToast();
  const [isEmailPending, startEmailTransition] = useTransition();
  const [isPasswordPending, startPasswordTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);

  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { newEmail: '', password: '' },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onEmailSubmit = (values: z.infer<typeof emailSchema>) => {
    startEmailTransition(async () => {
      if (!user || !user.email) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No user is currently logged in.',
        });
        return;
      }

      try {
        const credential = EmailAuthProvider.credential(user.email, values.password);
        await reauthenticateWithCredential(user, credential);
        await updateEmail(user, values.newEmail);

        toast({
          title: 'Email Updated',
          description: `Your login email has been changed to ${values.newEmail}.`,
        });
        emailForm.reset();
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Failed to Update Email',
          description: getFirebaseAuthErrorMessage(error),
        });
      }
    });
  };

  const onPasswordSubmit = (values: z.infer<typeof passwordSchema>) => {
    startPasswordTransition(async () => {
      if (!user || !user.email) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No user is currently logged in.',
        });
        return;
      }
      try {
        const credential = EmailAuthProvider.credential(user.email, values.currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, values.newPassword);

        toast({
          title: 'Password Updated',
          description: 'Your password has been changed successfully.',
        });
        passwordForm.reset();
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Failed to Update Password',
          description: getFirebaseAuthErrorMessage(error),
        });
      }
    });
  };
  

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <KeyRound className="h-5 w-5 text-secondary-foreground" />
          </span>
          <div>
            <CardTitle>Account Settings</CardTitle>
            <CardDescription>Manage your login email and password.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Change Email Form */}
        <Form {...emailForm}>
          <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
            <h3 className="font-medium">Change Email</h3>
            <FormField
              control={emailForm.control}
              name="newEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="new.email@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={emailForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Enter current password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isEmailPending}>
              {isEmailPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Email
            </Button>
          </form>
        </Form>

        <Separator />

        {/* Change Password Form */}
        <Form {...passwordForm}>
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
            <h3 className="font-medium">Change Password</h3>
            <FormField
              control={passwordForm.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
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
              control={passwordForm.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={passwordForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm New Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isPasswordPending}>
              {isPasswordPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Password
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
