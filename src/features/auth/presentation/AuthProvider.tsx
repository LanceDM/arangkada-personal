import type { ReactNode } from 'react';
import { AuthSessionContext } from '@/features/auth/application/authSession';
import { useObservedAuthSession } from '@/features/auth/application/useObservedAuthSession';

export const AuthProvider = ({ children }: { children: ReactNode }) => (
  <AuthSessionContext.Provider value={useObservedAuthSession()}>
    {children}
  </AuthSessionContext.Provider>
);
