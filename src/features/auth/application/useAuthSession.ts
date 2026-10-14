import { useContext } from 'react';
import { AuthSessionContext, type AuthSession } from './authSession';

/** The current session. Safe anywhere under `AuthProvider`. */
export const useAuthSession = (): AuthSession => useContext(AuthSessionContext);
