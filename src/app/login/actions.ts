'use server';

import { doc, setDoc } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase/server';
import type { UserDoc, AppData } from '@/lib/types';
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
    
    // Create a fresh copy of the initial app data structure
    const appData: AppData = {
        ...JSON.parse(JSON.stringify(initialData)),
        username: username, // Set the user-specific username
    };
    
    // Create the full UserDoc payload with the correct nested structure.
    const userDocPayload: UserDoc = {
      id: userId,
      email: email,
      appData: appData,
    };

    const userDocRef = doc(firestore, 'users', userId);
    
    try {
        // Using setDoc to create the document with the full payload
        await setDoc(userDocRef, userDocPayload);
        return { success: true, userId: userId };
    } catch (serverError: any) {
        // Create the rich, contextual error.
        const permissionError = new FirestorePermissionError({
          path: userDocRef.path,
          operation: 'create',
          requestResourceData: userDocPayload,
        });

        // Emit the error. This can be caught by a global listener on the client
        // or will just be logged on the server.
        errorEmitter.emit('permission-error', permissionError);

        // Return a generic error to the client for security.
        return { success: false, error: 'Could not create user profile in database.' };
    }
}

    