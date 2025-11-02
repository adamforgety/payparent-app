'use server';

import { doc, setDoc } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase/server';
import type { UserDoc } from '@/lib/types';
import { initialData } from '@/lib/data';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


/**
 * Handles the creation of a new user document in Firestore after sign-up.
 */
export async function handleNewUser(userId: string, email: string | null, username: string) {
    if (!userId || !email) {
        return { success: false, error: 'User ID or email not provided.' };
    }

    const { firestore } = initializeFirebase();
    
    // Deep copy initial data and set the user-specific username.
    const appData = JSON.parse(JSON.stringify(initialData));
    appData.username = username;
    
    // Create the full UserDoc payload with the correct nested structure.
    const userDocPayload: UserDoc = {
      id: userId,
      email: email,
      appData: appData,
    };

    const userDocRef = doc(firestore, 'users', userId);
    
    try {
        await setDoc(userDocRef, userDocPayload);
        return { success: true, userId: userId };
    } catch (serverError: any) {
        // Create the rich, contextual error.
        const permissionError = new FirestorePermissionError({
          path: userDocRef.path,
          operation: 'create',
          requestResourceData: userDocPayload,
        });

        // The error is emitted globally and will be caught by a listener component.
        // For server actions, this error will now appear in the server logs.
        errorEmitter.emit('permission-error', permissionError);

        return { success: false, error: 'Could not create user profile in database.' };
    }
}
