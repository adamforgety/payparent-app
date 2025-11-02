'use server';

import { doc, setDoc } from 'firebase/firestore';
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
    };

    const userDocRef = doc(firestore, 'users', userId);
    
    try {
        // Using setDoc to create the document with the full payload
        await setDoc(userDocRef, userDocPayload);
        return { success: true, userId: userId };
    } catch (serverError: any) {
        // In a real app, you would log this error to a monitoring service.
        console.error('Error creating user document:', serverError);
        
        // Return a generic error to the client for security.
        return { success: false, error: 'Could not create user profile in database.' };
    }
}
