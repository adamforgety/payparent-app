'use server';

import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase/server';
import type { UserDoc } from '@/lib/types';
import { initialData } from '@/lib/data';

/**
 * Finds a user's email by their username.
 * This enables them to log in with a username instead of an email.
 */
export async function findEmailByUsername(username: string): Promise<string | null> {
  try {
    const { firestore } = initializeFirebase();
    const usersRef = collection(firestore, 'users');
    // Correctly query the nested appData.username field.
    const q = query(usersRef, where('appData.username', '==', username));
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
