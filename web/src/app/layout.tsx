import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { resolveRequestLanguage } from '@/lib/server-language';

export const metadata: Metadata = {
  title: 'Tama Hidrovias',
  description: 'Hydrology platform for monitoring stations, measurements, and forecasts.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const language = await resolveRequestLanguage();

  return (
    <html lang={language} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers initialLanguage={language}>{children}</Providers>
      </body>
    </html>
  );
}
