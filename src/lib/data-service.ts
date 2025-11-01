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
 * It also corrects old default parent names if found.
 * @param firestore - The Firestore instance.
 * @param userId - The ID of the user.
 * @returns A promise that resolves to the AppData.
 */
export async function getUserData(firestore: Firestore, userId: string): Promise<AppData> {
  const userDocRef = doc(firestore, 'users', userId);
  try {
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      // Document exists, get its data.
      const userDoc = docSnap.data() as UserDoc;
      let appData = userDoc.appData;

      // Check for and correct old parent names.
      let needsUpdate = false;
      for (const monthId in appData.months) {
        const monthData = appData.months[monthId];
        if (monthData.parentNames['Parent 1'] === 'Mother' || monthData.parentNames['Parent 2'] === 'Father') {
          monthData.parentNames['Parent 1'] = 'Parent 1';
          monthData.parentNames['Parent 2'] = 'Parent 2';
          needsUpdate = true;
        }
      }

      // If we corrected any names, save the changes back to Firestore.
      if (needsUpdate) {
        console.log("Correcting old parent names in the database.");
        await saveUserData(firestore, userId, appData);
      }

      return appData;
    } else {
      // Document doesn't exist, create it with initial data.
      console.log('No user document found. Creating one with initial data.');
      const initial = { ...initialData, id: userId };
      await saveUserData(firestore, userId, initial);
      
      // Return the initial data for immediate use in the app.
      return initial;
    }
  } catch (error) {
    console.error("Error fetching or creating user document:", error);
    // In case of error, fall back to a local version of initial data.
    return { ...initialData, id: userId };
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
  const userDocPayload: UserDoc = { id: userId, appData };
  
  try {
    await setDoc(userDocRef, userDocPayload, { merge: true });
  } catch (error) {
     errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: userDocRef.path,
        operation: 'write',
        requestResourceData: userDocPayload,
      })
    );
    // Re-throw the error if you want the caller to be able to handle it too
    throw error;
  }
}
