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
export async function handleNewUser(userId: string, email: string | null, username?: string) {
    if (!userId) {
        return { success: false, error: 'User not found.' };
    }

    const { firestore } = initializeFirebase();
    
    // Deep copy initial data and set the user-specific ID and username.
    const appData = JSON.parse(JSON.stringify(initialData));
    if (username) {
        appData.username = username;
    }
    
    // Create the full UserDoc payload with the correct nested structure.
    const userDocPayload: UserDoc = {
      id: userId,
      email: email,
      appData: appData,
    };

    const userDocRef = doc(firestore, 'users', userId);
    
    // Use setDoc to create the document for the new user.
    // Chain a .catch() to handle permission errors specifically.
    try {
        await setDoc(userDocRef, userDocPayload);
        return { success: true, userId: userId };
      } catch (error: any) {
        // This is where we create and emit the detailed error
        const permissionError = new FirestorePermissionError({
          path: userDocRef.path,
          operation: 'create',
          requestResourceData: userDocPayload,
        });

        // We can't send the custom error object directly to the client from a server action,
        // so we log it on the server and send a generic message.
        // The important part is that this detailed error will now appear in your server logs
        // for debugging. In a real-world scenario, you'd use a proper logging service.
        console.error("Firestore Permission Error Context:", JSON.stringify(permissionError.request, null, 2));

        // For the client, return a user-friendly error.
        return { success: false, error: 'A security rule prevented user creation.' };
      }
}
