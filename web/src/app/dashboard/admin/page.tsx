import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import AppSettingsPanel from '@/components/AppSettingsPanel';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/roles';

/**
 * Administrative settings route under ``/dashboard/admin``.
 *
 * Only users with admin-level roles are allowed to access this page;
 * others are redirected back to the main dashboard.
 */
export default async function DashboardAdminPage() {
  const session = await getServerSession(authOptions);

  if (!session || !canAccessAdmin(session.user.role)) {
    redirect('/dashboard');
  }

  return <AppSettingsPanel />;
}