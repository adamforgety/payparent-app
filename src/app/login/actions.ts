'use server';

import { z } from 'zod';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, AuthErrorCodes } from 'firebase/auth';
import { initializeFirebase } from '@/firebase';

const { auth } = initializeFirebase();

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
            default:
                return "An unexpected error occurred. Please try again.";
        }
    }
    return "An unknown error occurred.";
}


export async function login(values: z.infer<typeof loginSchema>) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
    return { success: true, userId: userCredential.user.uid };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function signup(values: z.infer<typeof signupSchema>) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
    return { success: true, userId: userCredential.user.uid };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}
