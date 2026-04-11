
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import ReadOnlyBadge from '@/components/ReadOnlyBadge';
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
          {isViewer ? (
            <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-amber-900 dark:from-amber-950 dark:to-slate-950">
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  Seu acesso ao painel esta em modo leitura.
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Voce pode explorar dados e relatorios, mas acoes de criacao e edicao permanecem bloqueadas.
                </p>
              </div>
              <ReadOnlyBadge className="self-start sm:self-center" />
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
