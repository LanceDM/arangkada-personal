/**
 * The sign-in panel's two forms (2026-11-18: log in by username or email; sign up
 * by username, email optional), for the team, admins and anyone outside the
 * study. Participants join and sign in on the study's own pages, though a
 * participant's username also works here.
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