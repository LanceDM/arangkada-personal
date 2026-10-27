/** The `users/{uid}` account document. Auth owns it: it is created here on sign-up. */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import type { UserProfileRepository } from '@/features/auth/application/ports';
import type { UserProfile } from '@/features/auth/domain/userProfile';

export const createUserProfile = async (uid: string, profile: UserProfile) => {
  await setDoc(doc(db, 'users', uid), profile);
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
};

export const firebaseUserProfileRepository: UserProfileRepository = {
  get: getUserProfile,
};
