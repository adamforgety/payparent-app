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
    // We are NOT awaiting the setDoc call. Instead, we chain a .catch() block
    // to it. This is a specific pattern required by the error handling architecture
    // to generate detailed, contextual errors for security rule violations.
    setDoc(userDocRef, userDocPayload).catch((serverError) => {
        // Create the rich, contextual error.
        const permissionError = new FirestorePermissionError({
          path: userDocRef.path,
          operation: 'create',
          requestResourceData: userDocPayload,
        });

        // The error is emitted globally and will be caught by a listener component.
        // This avoids manual console.error and provides a better debugging experience.
        // For server actions, this error will now appear in the server logs.
        errorEmitter.emit('permission-error', permissionError);
    });

    // We return success optimistically. If an error occurs, it will be
    // handled by the global error handler.
    return { success: true, userId: userId };
}
