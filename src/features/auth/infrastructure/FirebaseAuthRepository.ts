/**
 * Firebase Authentication for Arangkada: email/password, Google, and the
 * account document each new sign-in must have.
 *
 * The SDK's `User` stops here. Everything above the port sees `AuthUser`.
 */
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  confirmPasswordReset,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  type User,
} from 'firebase/auth';
import { auth } from '@/shared/infrastructure/firebase/client';
import type { AuthGateway } from '@/features/auth/application/ports';
import type { AuthUser } from '@/features/auth/domain/userProfile';
import { createUserProfile, getUserProfile } from './FirebaseUserRepository';

/**
 * Admin is read from the token the session already holds, so a claim granted
 * since that token was issued arrives with the next sign-in, not this one.
 */
const hasAdminClaim = async (user: User): Promise<boolean> => {
  try {
    const { claims } = await user.getIdTokenResult();
    return claims.admin === true;
  } catch {
    // An expired token that cannot be refreshed, e.g. offline: the session
    // still opens, without admin.
    return false;
  }
};

const toAuthUser = async (user: User): Promise<AuthUser> => ({
  uid: user.uid,
  email: user.email,
  emailVerified: user.emailVerified,
  isAdmin: await hasAdminClaim(user),
});

const NEW_ACCOUNT = {
  totalScore: 0,
  longestStreak: 0,
  bestExamScore: 0,
} as const;

/** Creates the account document if this Google sign-in has never had one. */
const ensureUserDoc = async (user: User) => {
  if (await getUserProfile(user.uid)) return;
  await createUserProfile(user.uid, {
    email: user.email ?? '',
    username: user.displayName ?? 'Driver',
    createdAt: Date.now(),
    ...NEW_ACCOUNT,
  });
};

const signIn = async (email: string, password: string): Promise<AuthUser> => {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return toAuthUser(result.user);
};

const signUp = async (email: string, password: string, username: string): Promise<AuthUser> => {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await createUserProfile(result.user.uid, {
    email,
    username,
    createdAt: Date.now(),
    ...NEW_ACCOUNT,
  });
  return toAuthUser(result.user);
};

/**
 * Popup first, full-page redirect when the browser blocks it. The redirect
 * branch resolves to null: the page is about to navigate away, and the sign-in
 * completes on the way back in through `completeRedirectSignIn`.
 */
const signInWithGoogle = async (): Promise<AuthUser | null> => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const result = await signInWithPopup(auth, provider);
    await ensureUserDoc(result.user);
    return toAuthUser(result.user);
  } catch (error: unknown) {
    const blocked =
      error instanceof Error &&
      (error.message.includes('popup-blocked') || error.message.includes('popup-closed-by-user'));
    if (!blocked) throw error;
    await signInWithRedirect(auth, provider);
    return null;
  }
};

/** Finishes a redirect sign-in on the load that follows it. */
const completeRedirectSignIn = async (): Promise<AuthUser | null> => {
  const result = await getRedirectResult(auth);
  if (!result?.user) return null;
  await ensureUserDoc(result.user);
  return toAuthUser(result.user);
};

export const firebaseAuthGateway: AuthGateway = {
  signIn,
  signUp,
  signInWithGoogle,
  signOut: async () => {
    await firebaseSignOut(auth);
  },
  requestPasswordReset: async email => {
    await sendPasswordResetEmail(auth, email, { url: `${window.location.origin}/play` });
  },
  confirmNewPassword: async (oobCode, newPassword) => {
    await confirmPasswordReset(auth, oobCode, newPassword);
  },
  completeRedirectSignIn,
  observeUser: onChange => {
    // Reading the claim is asynchronous, so a sign-out can land while the
    // sign-in before it is still being read. Only the latest change reports.
    let latest = 0;
    return onAuthStateChanged(auth, async user => {
      const change = ++latest;
      const next = user ? await toAuthUser(user) : null;
      if (change === latest) onChange(next);
    });
  },
};
