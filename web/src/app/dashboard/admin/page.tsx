import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import AppSettingsPanel from '@/components/AppSettingsPanel';
import { authOptions } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/roles';

export default async function DashboardAdminPage() {
  const session = await getServerSession(authOptions);

  if (!session || !canAccessAdmin(session.user.role)) {
    redirect('/dashboard');
  }

  return <AppSettingsPanel />;
}