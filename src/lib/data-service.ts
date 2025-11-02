'use client';

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { initialData } from '@/lib/data';
import type { AppData, UserDoc } from '@/lib/types';
import type { Firestore } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

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
      // Document exists, return its data.
      const userDoc = docSnap.data() as UserDoc;
      return userDoc.appData;
    } else {
      // Document doesn't exist, create it with initial data.
      console.log('No user document found. Creating one with initial data.');
      
      const initial = JSON.parse(JSON.stringify(initialData));
      initial.id = userId;
      
      await saveUserData(firestore, userId, initial);
      
      // Return the initial data for immediate use in the app.
      return initial;
    }
  } catch (error) {
    console.error("Error fetching or creating user document:", error);
    // In case of error, fall back to a local version of initial data.
    const fallbackData = JSON.parse(JSON.stringify(initialData));
    fallbackData.id = userId;
    return fallbackData;
  }
}

/**
 * Saves the user's application data to Firestore.
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
  const userDocPayload: UserDoc = { 
    id: userId, 
    appData: appData, 
    email: appData.months[Object.keys(appData.months)[0]]?.parentNames?.['Parent 1'] || null,
    username: appData.username,
  };
  
  // Create a deep copy to avoid Firestore read-only errors in dev
  const payloadToSave = JSON.parse(JSON.stringify(userDocPayload));

  try {
    await setDoc(userDocRef, payloadToSave, { merge: true });
  } catch (error) {
     errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: userDocRef.path,
        operation: 'write',
        requestResourceData: payloadToSave,
      })
    );
    // Re-throw the error if you want the caller to be able to handle it too
    throw error;
  }
}

    