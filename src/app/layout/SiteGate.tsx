/**
 * The site suspended by an admin (Admin > Overview > Site status): every page
 * but the admin area shows players a paused screen, live, the moment it is
 * set. Admins pass through everywhere, and anyone can still open the sign-in,
 * so an admin can reach the switch.
 */
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { PauseCircle } from 'lucide-react';
import { useAuthModal, useAuthSession } from '@/features/auth';
import { useSiteStatus } from '@/features/admin';
import { Say } from '@/shared/i18n/language';

export const SiteGate = ({ children }: { children: ReactNode }) => {
  const { isAdmin, isLoggedIn } = useAuthSession();
  const { open } = useAuthModal();
  const { status } = useSiteStatus();
  const { pathname } = useLocation();

  if (!status?.suspended || isAdmin || pathname.startsWith('/admin')) return <>{children}</>;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <PauseCircle className="h-12 w-12 text-yellow-400" />
      <h1 className="text-3xl font-black uppercase italic">
        <Say en="Arangkada is paused" fil="Naka-pause ang Arangkada" />
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {status.message || <Say en="The session is paused for now. Your progress is saved; please wait for the facilitator." fil="Naka-pause muna ang session. Naka-save ang iyong progreso; hintayin ang facilitator." />}
      </p>
      {!isLoggedIn && (
        <button onClick={() => open({ defaultView: 'login' })} className="text-xs text-muted-foreground underline hover:text-foreground">
          <Say en="Admin sign in" fil="Admin sign in" />
        </button>
      )}
    </main>
  );
};
