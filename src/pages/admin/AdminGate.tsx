/**
 * The admin pages' door: their content only for an account whose sign-in
 * token carries the admin claim; otherwise a sign-in or a refusal.
 */
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { signOut, useAuthModal, useAuthSession } from '@/features/auth';

export const AdminGate = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, isAdmin } = useAuthSession();
  const { open: openAuthModal } = useAuthModal();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background text-muted-foreground flex items-center justify-center">
        Checking admin access...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Card className="max-w-md border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Shield className="h-5 w-5" />
              Admin sign in
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Sign in with an account the developers have granted admin access.</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() =>
                  openAuthModal({
                    defaultView: 'login',
                    reason: 'Sign in to open the Arangkada admin dashboard.',
                  })
                }
              >
                Sign in
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/play">
                  <ArrowLeft className="h-4 w-4" />
                  Back to game
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Card className="max-w-md border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Admin access required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              You are signed in as <span className="text-foreground">{profile?.email || profile?.username || 'a player'}</span>,
              but this account does not have admin access.
            </p>
            <p>
              The developers grant it with{' '}
              <code className="rounded bg-muted px-1 py-0.5">the developers' admin script with &lt;email&gt;</code>. Sign
              out and in again once it has been granted.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/play">
                  <ArrowLeft className="h-4 w-4" />
                  Back to game
                </Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};
