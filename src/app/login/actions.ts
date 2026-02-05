'use server';

import { initializeFirebase } from '@/firebase/server';
import type { UserDoc, AppData } from '@/lib/types';
import { initialData } from '@/lib/data';

/**
 * Handles the creation of a new user document in Firestore after sign-up.
 */
export async function handleNewUser(userId: string, email: string | null) {
    if (!userId || !email) {
        return { success: false, error: 'User ID or email not provided.' };
    }

    const { firestore } = initializeFirebase();
    
    // Create a fresh copy of the initial app data structure
    const appData: AppData = {
        ...JSON.parse(JSON.stringify(initialData)),
    };
    
    // Create the full UserDoc payload with the correct nested structure.
    const userDocPayload: UserDoc = {
      id: userId,
      email: email,
      appData: appData,
      coParentId: null,
      dataOwnerId: userId, // Initially, the user owns their own data.
    };

    const userDocRef = firestore.collection('users').doc(userId);
    
    try {
        // Using the admin SDK's .set() method
        await userDocRef.set(userDocPayload);
        return { success: true, userId: userId };
    } catch (serverError: any) {
        // In a real app, you would log this error to a monitoring service.
        console.error('Error creating user document:', serverError);
        
        // Return a generic error to the client for security.
        return { success: false, error: 'Could not create user profile in database.' };
    }
}
