'use client';

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { initialData } from '@/lib/data';
import type { AppData, UserDoc } from '@/lib/types';
import type { Firestore } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { getAuth } from 'firebase/auth';
import { handleNewUser } from '@/app/login/actions';

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
      // Make sure the top-level username is synced with appData
      if (userDoc.appData.username !== userDoc.username) {
        userDoc.appData.username = userDoc.username;
      }
      return userDoc.appData;
    } else {
      // Document doesn't exist, create it with initial data.
      console.log('No user document found. Creating one with initial data.');
      
      const auth = getAuth();
      const email = auth.currentUser?.email || null;
      const username = auth.currentUser?.displayName || undefined; // Or another source for username

      await handleNewUser(userId, email, username);
      
      const newInitialData = JSON.parse(JSON.stringify(initialData));
      newInitialData.id = userId;
      newInitialData.username = username;

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
 * This function performs a merge, so you only need to provide the fields to update.
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
  
  // To keep the top-level username in sync, we create a payload that updates both locations.
  const payloadToSave: { [key: string]: any } = {
    appData: appData
  };

  if (appData.username !== undefined) {
    payloadToSave.username = appData.username;
  }
  
  // Firestore's setDoc with { merge: true } can't handle nested objects well without this.
  // We need to use dot notation for nested fields to ensure only they are updated.
  const flattenedPayload: { [key: string]: any } = {};
  if (payloadToSave.username !== undefined) {
    flattenedPayload['username'] = payloadToSave.username;
  }

  for (const key in payloadToSave.appData) {
    if (Object.prototype.hasOwnProperty.call(payloadToSave.appData, key)) {
      flattenedPayload[`appData.${key}`] = (payloadToSave.appData as any)[key];
    }
  }


  try {
    // Use updateDoc to merge changes into the nested appData object correctly.
    // Using setDoc with merge would overwrite the entire appData object.
    await setDoc(userDocRef, flattenedPayload, { merge: true });

  } catch (error) {
     errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: userDocRef.path,
        operation: 'update', // or 'write'
        requestResourceData: flattenedPayload,
      })
    );
    // Re-throw the error if you want the caller to be able to handle it too
    throw error;
  }
}
