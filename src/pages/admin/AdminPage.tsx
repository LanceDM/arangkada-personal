import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { AdminDashboard, useAdminDashboard, useAdminData } from '@/features/admin';
import { useAuthSession } from '@/features/auth';
import { useAuthModal } from '@/features/auth';
import { signOut } from '@/features/auth';

const Admin = () => {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, isAdmin } = useAuthSession();
  const { open: openAuthModal } = useAuthModal();
  const adminData = useAdminData(isAdmin);
  const dashboard = useAdminDashboard(adminData);

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
              You are signed in as <span className="text-foreground">{profile?.email ?? user.email ?? 'a player'}</span>,
              but this account does not have admin access.
            </p>
            <p>
              The developers grant it with their admin script. Sign out and in
              again once it has been granted.
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

  return (
    <AdminDashboard
      userEmail={profile?.email ?? user.email}
      users={adminData.users}
      attempts={adminData.attempts}
      examResultsCount={adminData.examResults.length}
      dailyResultsCount={adminData.dailyResults.length}
      isLoading={adminData.isLoading}
      loadError={adminData.loadError}
      collectionErrors={adminData.collectionErrors}
      onRefresh={adminData.loadAdminData}
      onSignOut={handleSignOut}
      rules={dashboard.rules}
      levelFilter={dashboard.levelFilter}
      onLevelFilterChange={dashboard.setLevelFilter}
      selectedUser={dashboard.selectedUser}
      onSelectUser={dashboard.setSelectedUserId}
      onClearSelectedUser={() => dashboard.setSelectedUserId(null)}
      filteredAttempts={dashboard.filteredAttempts}
      selectedUserResults={dashboard.selectedUserResults}
      selectedUserAttempts={dashboard.selectedUserAttempts}
      selectedUserDailyResults={dashboard.selectedUserDailyResults}
      selectedUserLogs={dashboard.selectedUserLogs}
      completedLevelCount={dashboard.completedLevelCount}
      totalViolations={dashboard.totalViolations}
      totalCorrect={dashboard.totalCorrect}
      averageScore={dashboard.averageScore}
      topWeakCompetencies={dashboard.topWeakCompetencies}
      onExportJSON={dashboard.exportJSON}
      onExportAttemptsCSV={dashboard.exportAttemptsCSV}
    />
  );
};

export default Admin;
