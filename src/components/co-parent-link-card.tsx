
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useState, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Link2, Copy, UserCheck, UserX } from 'lucide-react';
import { doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';

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
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { Separator } from './ui/separator';
import { useAppContext } from '@/context/app-context';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const linkSchema = z.object({
  coParentCode: z.string().trim().min(1, { message: 'Co-parent code is required.' }),
});

export function CoParentLinkCard() {
  const { auth, firestore, user } = useFirebase();
  const { coParentData } = useAppContext();
  const { toast } = useToast();
  const [isLinking, startLinking] = useTransition();
  const [isUnlinking, startUnlinking] = useTransition();

  const form = useForm<z.infer<typeof linkSchema>>({
    resolver: zodResolver(linkSchema),
    defaultValues: { coParentCode: '' },
  });

  const handleCopyToClipboard = () => {
    if (!user) return;
    navigator.clipboard.writeText(user.uid);
    toast({ title: 'Copied!', description: 'Your co-parent code has been copied to the clipboard.' });
  };
  
  const onLinkSubmit = (values: z.infer<typeof linkSchema>) => {
    startLinking(async () => {
      if (!user || !firestore) return;
  
      const coParentId = values.coParentCode;
  
      if (coParentId === user.uid) {
        toast({ variant: 'destructive', title: 'Error', description: 'You cannot link to your own account.' });
        return;
      }
      
      const coParentDocRef = doc(firestore, 'users', coParentId);
      const currentUserDocRef = doc(firestore, 'users', user.uid);
      
      try {
        const coParentDoc = await getDoc(coParentDocRef);
        if (!coParentDoc.exists()) {
          toast({ variant: 'destructive', title: 'Co-Parent Not Found', description: 'The co-parent code is invalid.' });
          return;
        }

        const batch = writeBatch(firestore);

        // Current user gives up data ownership and links to co-parent.
        batch.update(currentUserDocRef, { 
          coParentId: coParentId,
          dataOwnerId: coParentId // Point to co-parent's data
        });
        
        // Co-parent keeps data ownership and links back to current user.
        batch.update(coParentDocRef, { 
          coParentId: user.uid,
          dataOwnerId: coParentId // They own their (and now your) data
        });
        
        await batch.commit();

        toast({ title: 'Success!', description: `You are now linked with ${coParentDoc.data().email}.` });
        form.reset();

      } catch (error) {
        const permissionError = new FirestorePermissionError({
            path: 'batch-write',
            operation: 'write', 
            requestResourceData: [
              { path: currentUserDocRef.path, data: { coParentId: coParentId, dataOwnerId: coParentId } },
              { path: coParentDocRef.path, data: { coParentId: user.uid, dataOwnerId: coParentId } }
            ]
        });
        errorEmitter.emit('permission-error', permissionError);
      }
    });
  };

  const handleUnlink = () => {
    startUnlinking(async () => {
      if (!user || !firestore) {
        toast({ variant: 'destructive', title: 'Error', description: 'User or database is not available.' });
        return;
      }
      
      if (!coParentData) {
        toast({ variant: 'destructive', title: 'Error', description: 'Co-parent data is not loaded. Cannot unlink.' });
        return;
      }

      const coParentId = coParentData.id;
      const coParentDocRef = doc(firestore, 'users', coParentId);
      const currentUserDocRef = doc(firestore, 'users', user.uid);

      const batch = writeBatch(firestore);
      
      // Reset current user to be their own data owner and remove link
      batch.update(currentUserDocRef, { 
        coParentId: null,
        dataOwnerId: user.uid
      });
      
      // Reset co-parent to be their own data owner and remove link
      batch.update(coParentDocRef, { 
        coParentId: null,
        dataOwnerId: coParentId
       });
      
      batch.commit()
        .then(() => {
          toast({ title: 'Unlinked Successfully', description: 'Your accounts are no longer connected.' });
        })
        .catch((error) => {
          const permissionError = new FirestorePermissionError({
            path: 'batch-write',
            operation: 'write',
            requestResourceData: [
              { path: currentUserDocRef.path, data: { coParentId: null, dataOwnerId: user.uid } },
              { path: coParentDocRef.path, data: { coParentId: null, dataOwnerId: coParentId } }
            ]
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <Link2 className="h-5 w-5 text-secondary-foreground" />
          </span>
          <div>
            <CardTitle>Co-Parent Account Linking</CardTitle>
            <CardDescription>Share finances by linking your account with your co-parent.</CardDescription>
          </div>
        </div>
      </CardHeader>
      
      {coParentData ? (
        <>
          <CardContent>
            <Alert>
              <UserCheck className="h-4 w-4" />
              <AlertTitle>You are Linked!</AlertTitle>
              <AlertDescription>
                You are sharing finances with <span className="font-semibold">{coParentData.email}</span>. All data is now synced between your accounts.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
             <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isUnlinking}>
                  {isUnlinking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserX className="mr-2 h-4 w-4" />}
                  Unlink Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure you want to unlink?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will stop data sharing between you and {coParentData.email}. You will both revert to your own separate data. This action can be undone by linking again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleUnlink}>
                    Yes, Unlink
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </>
      ) : (
        <>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-medium">Your Co-Parent Code</h3>
              <p className="text-sm text-muted-foreground mb-2">Share this code with your co-parent. They will use it to link to your account.</p>
              <div className="flex items-center gap-2">
                <Input readOnly value={user?.uid ?? 'Loading...'} />
                <Button variant="outline" size="icon" onClick={handleCopyToClipboard} disabled={!user}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Separator />

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onLinkSubmit)} className="space-y-4">
                <h3 className="font-medium">Link to Co-Parent</h3>
                <p className="text-sm text-muted-foreground">Enter the code your co-parent shared with you to link accounts.</p>
                <FormField
                  control={form.control}
                  name="coParentCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Co-Parent's Code</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter code..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isLinking}>
                  {isLinking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Link Accounts
                </Button>
              </form>
            </Form>
          </CardContent>
        </>
      )}
    </Card>
  );
}
