
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';

// Fake auth logic for development
function isFakeAuthEnabled() {
  return process.env.FAKE_AUTH === 'true';
}

const fakeSession = {
  user: {
    name: 'Dev User',
    email: 'dev@example.com',
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

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex flex-1 flex-col md:flex-row">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-gray-50 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
