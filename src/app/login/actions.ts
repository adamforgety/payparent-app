'use server';

import { doc, setDoc } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase/server';
import type { UserDoc } from '@/lib/types';
import { initialData } from '@/lib/data';

/**
 * Handles the creation of a new user document in Firestore after sign-up.
 */
export async function handleNewUser(userId: string, email: string | null, username?: string) {
    if (!userId) {
        return { success: false, error: 'User not found.' };
    }
    try {
        const { firestore } = initializeFirebase();
        
        // Deep copy initial data and set the user-specific ID and username.
        const appData = JSON.parse(JSON.stringify(initialData));
        appData.id = userId;
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
        await setDoc(userDocRef, userDocPayload);

        return { success: true, userId: userId };
    } catch (error: any) {
        console.error("Error in handleNewUser:", error);
        return { success: false, error: error.message || 'An unknown error occurred during user creation.' };
    }
}
