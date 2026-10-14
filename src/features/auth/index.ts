/** Auth's public API. Everything else in this folder is internal. */
export { AuthProvider } from './presentation/AuthProvider';
export { default as AuthModal } from './presentation/AuthModal';
export { default as AuthForm } from './presentation/AuthForm';
export { useAuthSession } from './application/useAuthSession';
export { useAuthModal } from './application/useAuthModal';
export {
  signOut,
  requestPasswordReset,
  confirmNewPassword,
  verifyEmailCode,
} from './application/authActions';
export type { AuthSession } from './application/authSession';
export type { AuthUser, UserProfile } from './domain/userProfile';
export type { AuthView } from './domain/credentials';
