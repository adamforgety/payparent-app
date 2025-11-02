'use client';

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
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
      // Use display name as a fallback for username if available
      const username = auth.currentUser?.displayName || undefined; 

      await handleNewUser(userId, email, username);
      
      // Return a local copy of the initial data for the current session.
      const newInitialData = JSON.parse(JSON.stringify(initialData));
      newInitialData.id = userId;
      if (username) {
        newInitialData.username = username;
      }
      return newInitialData;
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
 * This performs a deep merge on the `appData` object.
 * @param firestore - The Firestore instance.
 * @param userId - The ID of the user.
 * @param appData - The partial application data to save.
 */
export async function saveUserData(firestore: Firestore, userId: string, appData: Partial<AppData>): Promise<void> {
  if (!firestore || !userId) {
    console.error("Firestore or User ID is not available. Cannot save.");
    return;
  }
  const userDocRef = doc(firestore, 'users', userId);
  
  // To merge nested objects, we use dot notation.
  // This creates a flat object like { 'appData.username': 'new_name', 'appData.months.2024-05': { ... } }
  const flattenedPayload: { [key: string]: any } = {};
  for (const key in appData) {
    if (Object.prototype.hasOwnProperty.call(appData, key)) {
      flattenedPayload[`appData.${key}`] = (appData as any)[key];
    }
  }

  try {
    // Use updateDoc to merge changes into the nested appData object correctly.
    await updateDoc(userDocRef, flattenedPayload);
  } catch (error) {
     errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: userDocRef.path,
        operation: 'update',
        requestResourceData: flattenedPayload,
      })
    );
    // Re-throw the error so the caller can handle it if needed
    throw error;
  }
}
