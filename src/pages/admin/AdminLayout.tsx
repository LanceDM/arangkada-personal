/**
 * `/admin/*`: the admin area. Admin only (`AdminGate`); one frame around every
 * section, each loaded as its own chunk when it is first opened.
 */
import { Suspense } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

import { AdminShell } from '@/features/admin';
import { signOut, useAuthSession } from '@/features/auth';
import { AdminGate } from './AdminGate';

const AdminLayout = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuthSession();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <AdminGate>
      <AdminShell userEmail={profile?.email || user?.email} onSignOut={handleSignOut}>
        <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}>
          <Outlet />
        </Suspense>
      </AdminShell>
    </AdminGate>
  );
};

export default AdminLayout;
