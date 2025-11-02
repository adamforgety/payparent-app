'use client';

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { initialData } from '@/lib/data';
import type { AppData, UserDoc } from '@/lib/types';
import type { Firestore } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { handleNewUser } from '@/app/login/actions';
import { getAuth } from 'firebase/auth';

async function getDocWithHandling<T>(docRef: any): Promise<T | null> {
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as T;
    }
    return null;
  } catch (error) {
     errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: docRef.path,
        operation: 'get',
      })
    );
    throw error;
  }
}

/**
 * Fetches the application data for the logged-in user.
 * It intelligently fetches data from the document specified by `dataOwnerId`.
 * @param firestore - The Firestore instance.
 * @param userId - The ID of the currently logged-in user.
 * @returns A promise that resolves to the AppData.
 */
export async function getUserData(firestore: Firestore, userId: string): Promise<AppData> {
  const currentUserDocRef = doc(firestore, 'users', userId);
  
  const currentUserDoc = await getDocWithHandling<UserDoc>(currentUserDocRef);

  if (!currentUserDoc) {
    console.log('No user document found. Creating one with initial data.');
    const auth = getAuth();
    const email = auth.currentUser?.email || null;
    await handleNewUser(userId, email);
    // After creating, fetch again to ensure consistency.
    const newUserDoc = await getDocWithHandling<UserDoc>(currentUserDocRef);
    return newUserDoc?.appData || JSON.parse(JSON.stringify(initialData));
  }

  const dataOwnerId = currentUserDoc.dataOwnerId || userId;

  if (dataOwnerId === userId) {
    return currentUserDoc.appData;
  }

  // Fetch data from the data owner's document
  const dataOwnerDocRef = doc(firestore, 'users', dataOwnerId);
  const dataOwnerDoc = await getDocWithHandling<UserDoc>(dataOwnerDocRef);

  if (dataOwnerDoc) {
    return dataOwnerDoc.appData;
  } else {
    // This indicates a data integrity issue, where the dataOwnerId points to a non-existent document.
    // As a fallback, revert the current user to be their own data owner.
    await updateDoc(currentUserDocRef, { dataOwnerId: userId, coParentId: null });
    return currentUserDoc.appData;
  }
}

/**
 * Saves the user's application data to Firestore.
 * This intelligently saves data to the correct document (the one specified by `dataOwnerId`).
 * @param firestore - The Firestore instance.
 * @param userId - The ID of the currently logged-in user making the change.
 * @param appData - The application data to save.
 */
export async function saveUserData(firestore: Firestore, userId: string, appData: AppData): Promise<void> {
  if (!firestore || !userId) {
    console.error("Firestore or User ID is not available. Cannot save.");
    return;
  }
  
  // First, get the current user's document to find out who the data owner is.
  const currentUserDocRef = doc(firestore, 'users', userId);
  const currentUserDocSnap = await getDoc(currentUserDocRef);
  
  if (!currentUserDocSnap.exists()) {
    console.error("Current user document not found. Cannot determine data owner.");
    return;
  }

  const currentUserDoc = currentUserDocSnap.data() as UserDoc;
  
  // Determine the correct document to write to.
  const targetUserId = currentUserDoc.dataOwnerId || userId;
  const targetDocRef = doc(firestore, 'users', targetUserId);
  
  const payload = { appData };

  try {
    // Use set with merge to update just the appData field on the owner's document.
    await setDoc(targetDocRef, payload, { merge: true });
  } catch (error) {
     errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: targetDocRef.path,
        operation: 'update',
        requestResourceData: payload,
      })
    );
    throw error;
  }
}
