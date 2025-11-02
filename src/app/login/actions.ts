'use server';

import { z } from 'zod';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, AuthErrorCodes, type User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import type { AppData, UserDoc } from '@/lib/types';
import { initialData } from '@/lib/data';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function getErrorMessage(error: any): string {
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


async function createNewUserDocument(firestore: any, userId: string): Promise<void> {
    const userDocRef = doc(firestore, 'users', userId);
    const initialAppData: AppData = { ...initialData, id: userId };
    const userDocPayload: UserDoc = { id: userId, appData: initialAppData };
    await setDoc(userDocRef, userDocPayload);
}

export async function login(values: z.infer<typeof loginSchema>) {
  try {
    const { auth } = initializeFirebase();
    const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
    return { success: true, userId: userCredential.user.uid };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function signup(values: z.infer<typeof signupSchema>) {
  try {
    const { auth, firestore } = initializeFirebase();
    const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
    // Create a new document in Firestore for the new user
    await createNewUserDocument(firestore, userCredential.user.uid);
    return { success: true, userId: userCredential.user.uid };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function handleGoogleSignIn(user: User) {
    if (!user) {
        return { success: false, error: 'User not found.' };
    }
    try {
        const { firestore } = initializeFirebase();
        const userDocRef = doc(firestore, 'users', user.uid);
        const docSnap = await getDoc(userDocRef);

        // If the user doesn't have a document in Firestore, create one.
        if (!docSnap.exists()) {
            await createNewUserDocument(firestore, user.uid);
        }

        return { success: true, userId: user.uid };

    } catch (error) {
        return { success: false, error: getErrorMessage(error) };
    }
}
