
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import DashboardReadOnlyBanner from '@/components/DashboardReadOnlyBanner';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { isViewerRole } from '@/lib/roles';

// Fake auth logic for development
function isFakeAuthEnabled() {
  return process.env.FAKE_AUTH === 'true';
}

const fakeSession = {
  user: {
    id: 'dev-user',
    name: 'Dev User',
    email: 'dev@example.com',
    role: 'analyst',
  },
};

/**
 * Shared layout for all ``/dashboard`` routes.
 *
 * Handles authentication (real or fake for development), enforces
 * redirects to the login page when unauthenticated and wraps child
 * routes with the main navbar, sidebar and read-only banner.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session = null;
  if (isFakeAuthEnabled()) {
    session = fakeSession;
  } else {
    session = await getServerSession(authOptions);
  }

  if (!session) {
    redirect('/login');
  }

  const isViewer = isViewerRole(session.user.role);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex flex-1 flex-col md:flex-row">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-gray-50 p-4 md:p-6 dark:bg-slate-950">
          {isViewer ? <DashboardReadOnlyBanner /> : null}
          {children}
        </main>
      </div>
    </div>
  );
}
