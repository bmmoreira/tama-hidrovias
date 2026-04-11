'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Droplets, Menu, X, LogOut, User } from 'lucide-react';

export default function Navbar() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold text-blue-700"
        >
          <Droplets className="h-6 w-6" />
          <span>Tama Hidrovias</span>
        </Link>

        {/* Desktop right side */}
        <div className="hidden items-center gap-4 sm:flex">
          <Link
            href="/map"
            className="text-sm text-gray-600 transition hover:text-blue-700"
          >
            Mapa
          </Link>
          {session ? (
            <>
              <Link
                href="/dashboard"
                className="text-sm text-gray-600 transition hover:text-blue-700"
              >
                Painel
              </Link>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700">{session.user?.name}</span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition hover:border-red-200 hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Entrar
            </Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 sm:hidden"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Menu"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-gray-100 bg-white px-4 pb-4 pt-2 sm:hidden">
          <nav className="flex flex-col gap-1">
            <Link
              href="/map"
              className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setMenuOpen(false)}
            >
              Mapa
            </Link>
            {session ? (
              <>
                <Link
                  href="/dashboard"
                  className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setMenuOpen(false)}
                >
                  Painel
                </Link>
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500">
                  <User className="h-4 w-4" />
                  {session.user?.name}
                </div>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    signOut({ callbackUrl: '/' });
                  }}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                onClick={() => setMenuOpen(false)}
              >
                Entrar
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
