'use server';

import { collection, query, where, getDocs } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase/server';
import type { AppData, UserDoc } from '@/lib/types';
import { initialData } from '@/lib/data';
import { saveUserData } from '@/lib/data-service';

/**
 * Finds a user's email by their username.
 * This enables them to log in with a username instead of an email.
 */
export async function findEmailByUsername(username: string): Promise<string | null> {
  try {
    const { firestore } = initializeFirebase();
    const usersRef = collection(firestore, 'users');
    // It's assumed usernames are unique. Add DB constraints if needed.
    const q = query(usersRef, where('username', '==', username));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }
    
    // Return the email of the first user found.
    const userDoc = querySnapshot.docs[0].data() as UserDoc;
    return userDoc.email;

  } catch (error) {
    console.error("Error finding user by username:", error);
    return null;
  }
}

/**
 * Handles the creation of a new user after email/password sign-up.
 * It ensures a corresponding user document is created in Firestore.
 */
export async function handleNewUser(userId: string, email: string | null, username?: string) {
    if (!userId) {
        return { success: false, error: 'User not found.' };
    }
    try {
        const { firestore } = initializeFirebase();
        
        // Deep copy initial data and set the user-specific ID and username
        const initialAppData: AppData = JSON.parse(JSON.stringify(initialData));
        initialAppData.id = userId;
        if (username) {
          initialAppData.username = username;
        }

        // Use the centralized saveUserData function to ensure correct document structure
        await saveUserData(firestore, userId, initialAppData, email);

        return { success: true, userId: userId };
    } catch (error: any) {
        console.error("Error in handleNewUser:", error);
        return { success: false, error: error.message || 'An unknown error occurred during user creation.' };
    }
}
