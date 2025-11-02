'use server';

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase/server';
import type { AppData, UserDoc } from '@/lib/types';
import { initialData } from '@/lib/data';

async function createNewUserDocument(firestore: any, userId: string, email: string | null): Promise<void> {
    const userDocRef = doc(firestore, 'users', userId);
    const initialAppData: AppData = { ...initialData, id: userId };
    const userDocPayload: UserDoc = { id: userId, email: email, appData: initialAppData };
    await setDoc(userDocRef, userDocPayload);
}

export async function handleNewUser(userId: string, email: string | null) {
     if (!userId) {
        return { success: false, error: 'User not found.' };
    }
    try {
        const { firestore } = initializeFirebase();
        await createNewUserDocument(firestore, userId, email);
        return { success: true, userId: userId };
    } catch (error: any) {
        return { success: false, error: error.message || 'An unknown error occurred during user creation.' };
    }
}


export async function handleGoogleSignIn(userId: string, email: string | null) {
    if (!userId) {
        return { success: false, error: 'User not found.' };
    }
    try {
        const { firestore } = initializeFirebase();
        const userDocRef = doc(firestore, 'users', userId);
        const docSnap = await getDoc(userDocRef);

        if (!docSnap.exists()) {
            await createNewUserDocument(firestore, userId, email);
        }

        return { success: true, userId: userId };

    } catch (error: any) {
        return { success: false, error: error.message || 'An unknown error occurred during Google sign-in.' };
    }
}
