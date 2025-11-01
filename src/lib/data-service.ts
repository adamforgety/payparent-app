'use client';

import { doc, getDoc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { initialData } from '@/lib/data';
import type { AppData, UserDoc } from '@/lib/types';
import type { Firestore } from 'firebase/firestore';

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
      const initial = { ...initialData, id: userId };
      const userDocPayload: UserDoc = { id: userId, appData: initial };
      
      // Save the new document to Firestore (non-blocking).
      setDocumentNonBlocking(userDocRef, userDocPayload, { merge: false });
      
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
export function saveUserData(firestore: Firestore, userId: string, appData: AppData): void {
  if (!firestore || !userId) {
    console.error("Firestore or User ID is not available. Cannot save.");
    return;
  }
  const userDocRef = doc(firestore, 'users', userId);
  const userDocPayload: UserDoc = { id: userId, appData };
  setDocumentNonBlocking(userDocRef, userDocPayload, { merge: true });
}
