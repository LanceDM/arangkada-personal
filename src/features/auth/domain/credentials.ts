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