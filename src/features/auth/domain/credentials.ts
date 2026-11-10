/**
 * The sign-in panel's two forms, both by email, for the team and admins. A
 * study participant never uses it: they join and sign in by username on the
 * study's own pages.
 */
export type AuthView = 'login' | 'register';

export interface AuthCredentials {
  email: string;
  password: string;
  username?: string;
}

export interface AuthFormProps {
  defaultView?: AuthView;
  onSuccess: () => void;
  onCancel?: () => void;
}