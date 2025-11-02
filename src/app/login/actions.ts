'use server';

import { AuthErrorCodes } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase/server';
import type { AppData, UserDoc } from '@/lib/types';
import { initialData } from '@/lib/data';

export function getErrorMessage(error: any): string {
    if (typeof error === 'string') return error;
    if (error && typeof error.code === 'string') {
        switch (error.code) {
            case AuthErrorCodes.INVALID_EMAIL:
                return "The email address is not valid.";
            case AuthErrorCodes.USER_DISABLED:
                return "This user account has been disabled.";
            case AuthErrorCodes.USER_NOT_FOUND:
            case AuthErrorCodes.INVALID_LOGIN_CREDENTIALS:
                return "Invalid email or password. Please try again.";
            case AuthErrorCodes.EMAIL_EXISTS:
                return "An account with this email address already exists.";
            case AuthErrorCodes.WEAK_PASSWORD:
                return "The password is too weak. It must be at least 8 characters long.";
            case 'auth/popup-closed-by-user':
                return 'Sign-in process was cancelled.';
            default:
                return "An unexpected error occurred. Please try again.";
        }
    }
    return "An unknown error occurred.";
}


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
    } catch (error) {
        return { success: false, error: getErrorMessage(error) };
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

    } catch (error) {
        return { success: false, error: getErrorMessage(error) };
    }
}
