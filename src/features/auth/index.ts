/** Auth's public API. Everything else in this folder is internal. */
export { AuthProvider } from './presentation/AuthProvider';
export { default as StudyPasswordForm } from './presentation/StudyPasswordForm';
export { default as AuthModal } from './presentation/AuthModal';
export { default as AuthForm } from './presentation/AuthForm';
export { useAuthSession } from './application/useAuthSession';
export { useAuthModal } from './application/useAuthModal';
export { useLanguagePreference } from './application/useLanguagePreference';
export {
  signOut,
  signInStudyAccount,
  createStudyAccount,
  StudyAuthError,
  requestPasswordReset,
  confirmNewPassword,
} from './application/authActions';
export type { AuthSession } from './application/authSession';
export type { AuthUser, UserProfile } from './domain/userProfile';
export type { AuthView } from './domain/credentials';
export {
  STUDY_PASSWORD_MAX,
  STUDY_PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_RULE,
  passwordProblem,
  studyUsernameOf,
  usernameProblem,
} from './domain/studyIdentity';
