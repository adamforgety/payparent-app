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
 * It intelligently fetches data from the co-parent's document if a link is established.
 * @param firestore - The Firestore instance.
 * @param userId - The ID of the currently logged-in user.
 * @returns A promise that resolves to the AppData.
 */
export async function getUserData(firestore: Firestore, userId: string): Promise<AppData> {
  const currentUserDocRef = doc(firestore, 'users', userId);
  
  const currentUserDoc = await getDocWithHandling<UserDoc>(currentUserDocRef);

  // If the current user has a coParentId, fetch the co-parent's data instead.
  if (currentUserDoc?.coParentId) {
    const coParentDocRef = doc(firestore, 'users', currentUserDoc.coParentId);
    const coParentDoc = await getDocWithHandling<UserDoc>(coParentDocRef);
    if (coParentDoc) {
      return coParentDoc.appData;
    } else {
      // The co-parent document was not found or accessible, which could be a data integrity issue.
      // Unlink the co-parent on the current user's doc and fall back to their own data.
      await updateDoc(currentUserDocRef, { coParentId: null });
      return currentUserDoc.appData || JSON.parse(JSON.stringify(initialData));
    }
  }

  // If no coParentId, use the current user's data.
  if (currentUserDoc) {
    return currentUserDoc.appData;
  } else {
    // This is a fallback for a rare case where the user document doesn't exist
    // after the login flow should have created it.
    console.log('No user document found. Creating one with initial data.');
    const auth = getAuth();
    const email = auth.currentUser?.email || null;
    await handleNewUser(userId, email);
    return JSON.parse(JSON.stringify(initialData));
  }
}

/**
 * Saves the user's application data to Firestore.
 * This intelligently saves data to the correct document (the user's or their co-parent's).
 * @param firestore - The Firestore instance.
 * @param userId - The ID of the currently logged-in user.
 * @param appData - The application data to save.
 */
export async function saveUserData(firestore: Firestore, userId: string, appData: AppData): Promise<void> {
  if (!firestore || !userId) {
    console.error("Firestore or User ID is not available. Cannot save.");
    return;
  }
  
  const currentUserDocRef = doc(firestore, 'users', userId);
  const currentUserDocSnap = await getDoc(currentUserDocRef);
  const currentUserDoc = currentUserDocSnap.data() as UserDoc;
  
  // Determine the correct document to write to. If there's a co-parent, write to their document.
  const targetUserId = currentUserDoc?.coParentId || userId;
  const targetDocRef = doc(firestore, 'users', targetUserId);
  
  const payload = { appData };

  try {
    // Use set with merge to update just the appData field.
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
