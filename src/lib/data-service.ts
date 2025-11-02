'use client';

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { initialData } from '@/lib/data';
import type { AppData, UserDoc } from '@/lib/types';
import type { Firestore } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { handleNewUser } from '@/app/login/actions';
import { getAuth } from 'firebase/auth';

/**
 * Fetches the user's application data from Firestore.
 * If the user document doesn't exist, it creates it with initial data.
 * @param firestore - The Firestore instance.
 * @param userId - The ID of the user.
 * @returns A promise that resolves to the AppData.
 */
export async function getUserData(firestore: Firestore, userId: string): Promise<AppData> {
  const userDocRef = doc(firestore, 'users', userId);
  try {
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      // Document exists, return its nested appData.
      const userDoc = docSnap.data() as UserDoc;
      return userDoc.appData;
    } else {
      // Document doesn't exist, create it with initial data.
      console.log('No user document found. Creating one with initial data.');
      
      const auth = getAuth();
      const email = auth.currentUser?.email || null;

      await handleNewUser(userId, email);
      
      // Return a local copy of the initial data for the current session.
      const newInitialData: AppData = {
          ...JSON.parse(JSON.stringify(initialData)),
      }
      return newInitialData;
    }
  } catch (error) {
    console.error("Error fetching or creating user document:", error);
    // In case of error, fall back to a local version of initial data.
    const fallbackData: AppData = {
        ...JSON.parse(JSON.stringify(initialData)),
    };
    return fallbackData;
  }
}

/**
 * Saves the user's application data to Firestore.
 * This performs an update on the user document.
 * @param firestore - The Firestore instance.
 * @param userId - The ID of the user.
 * @param appData - The application data to save.
 */
export async function saveUserData(firestore: Firestore, userId: string, appData: AppData): Promise<void> {
  if (!firestore || !userId) {
    console.error("Firestore or User ID is not available. Cannot save.");
    return;
  }
  const userDocRef = doc(firestore, 'users', userId);
  
  // Create the payload to be saved. We are replacing the entire appData object.
  const payload = {
    appData: appData
  };

  try {
    // Use set with merge:true to update the appData field without overwriting other top-level fields like 'id' or 'email'.
    await setDoc(userDocRef, payload, { merge: true });
  } catch (error) {
     errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: userDocRef.path,
        operation: 'update',
        requestResourceData: payload,
      })
    );
    // Re-throw the error so the caller can handle it if needed
    throw error;
  }
}
