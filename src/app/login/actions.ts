'use server';

import { doc, setDoc } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase/server';
import type { AppData, UserDoc } from '@/lib/types';
import { initialData } from '@/lib/data';

/**
 * Creates a new user document in Firestore with initial data structure.
 * This is called when a user signs up for the first time.
 */
async function createNewUserDocument(firestore: any, userId: string, email: string | null): Promise<void> {
    const userDocRef = doc(firestore, 'users', userId);
    
    // Deep copy initial data and set the user-specific ID
    const initialAppData: AppData = JSON.parse(JSON.stringify(initialData));
    initialAppData.id = userId;

    const userDocPayload: UserDoc = { 
        id: userId, 
        email: email, 
        appData: initialAppData 
    };

    await setDoc(userDocRef, userDocPayload);
}

/**
 * Handles the creation of a new user after email/password sign-up.
 * It ensures a corresponding user document is created in Firestore.
 */
export async function handleNewUser(userId: string, email: string | null) {
    if (!userId) {
        return { success: false, error: 'User not found.' };
    }
    try {
        const { firestore } = initializeFirebase();
        await createNewUserDocument(firestore, userId, email);
        return { success: true, userId: userId };
    } catch (error: any) {
        console.error("Error in handleNewUser:", error);
        return { success: false, error: error.message || 'An unknown error occurred during user creation.' };
    }
}
