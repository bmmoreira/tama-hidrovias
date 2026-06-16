'use client';

import { useState } from 'react';
import { Ship } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const TEAM_MEMBERS = [
  { name: 'Alice César Fassoni de Andrade', color: 'bg-sky-500' },
  { name: 'Bruno Moreira', color: 'bg-blue-600' },
  { name: 'Daniel Medeiros Moreira', color: 'bg-indigo-500' },
  { name: 'Fernanda Pereira dos Santos', color: 'bg-emerald-600' },
  { name: 'Ingrid Petry', color: 'bg-violet-500' },
  { name: 'Leonardo Zandonadi', color: 'bg-teal-600' },
  { name: 'Marcus Suassuna Santos', color: 'bg-cyan-600' },


];

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter((w) => w.length > 1 && /^[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÈÙ]/u.test(w[0]))
    .slice(0, 2)
    .map((p) => p[0])
    .join('');
}

export default function WelcomeModal() {
  const [open, setOpen] = useState(true);

  return (
    <>
      <style>{`
        @keyframes ship-bob {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50%       { transform: translateY(-12px) rotate(3deg); }
        }
        @keyframes wave-a {
          0%, 100% { transform: translateX(0); opacity: 0.55; }
          50%       { transform: translateX(-9px); opacity: 0.8; }
        }
        @keyframes wave-b {
          0%, 100% { transform: translateX(0); opacity: 0.4; }
          50%       { transform: translateX(10px); opacity: 0.65; }
        }
        @keyframes glow-ring {
          0%, 100% { box-shadow: 0 0 18px 3px rgba(56,189,248,0.22); }
          50%       { box-shadow: 0 0 30px 8px rgba(56,189,248,0.42); }
        }
        .welcome-ship-bob  { animation: ship-bob  3.2s ease-in-out infinite; }
        .welcome-wave-a    { animation: wave-a    2.8s ease-in-out infinite; }
        .welcome-wave-b    { animation: wave-b    3.1s ease-in-out infinite 0.6s; }
        .welcome-glow-ring { animation: glow-ring 3s   ease-in-out infinite; }
      `}</style>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          hideCloseButton
          className="max-w-sm overflow-hidden rounded-3xl border-0 p-0 shadow-2xl"
        >
          {/* ── Ocean header ── */}
          <div className="relative flex flex-col items-center overflow-hidden bg-gradient-to-b from-sky-600 via-sky-800 to-slate-900 pb-8 pt-10">
            {/* Decorative background circles */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
              <div className="absolute -bottom-6 -right-8 h-32 w-32 rounded-full bg-white/5" />
              <div className="absolute left-2/3 top-1/4 h-16 w-16 rounded-full bg-sky-400/10" />
            </div>

            {/* Ship icon */}
            <div className="welcome-glow-ring relative z-10 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-white/10 ring-2 ring-sky-300/40 backdrop-blur-sm">
              <div className="welcome-ship-bob">
                <Ship className="h-9 w-9 text-white drop-shadow-lg" strokeWidth={1.5} />
              </div>
            </div>

            {/* Wave lines below ship */}
            <div className="relative z-10 mt-3 flex flex-col items-center gap-0.5">
              <svg
                width="120"
                height="8"
                viewBox="0 0 120 8"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="welcome-wave-a"
              >
                <path
                  d="M0 4 Q15 0 30 4 Q45 8 60 4 Q75 0 90 4 Q105 8 120 4"
                  stroke="rgba(186,230,253,0.75)"
                  strokeWidth="1.5"
                  fill="none"
                />
              </svg>
              <svg
                width="96"
                height="8"
                viewBox="0 0 96 8"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="welcome-wave-b"
              >
                <path
                  d="M0 4 Q12 0 24 4 Q36 8 48 4 Q60 0 72 4 Q84 8 96 4"
                  stroke="rgba(125,211,252,0.5)"
                  strokeWidth="1.2"
                  fill="none"
                />
              </svg>
            </div>

            {/* Platform name */}
            <div className="relative z-10 mt-5 flex flex-col items-center">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-300">
                TAMA
              </span>
              <h2 className="mt-0.5 text-base font-bold tracking-wide text-white">
                Hidrovias
              </h2>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="flex flex-col gap-5 bg-white px-6 pb-6 pt-5 dark:bg-slate-950">
            {/* Description */}
            <p className="text-center text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
              Plataforma de monitoramento hidrológico para hidrovias na região dos rios{' '}
              <span className="font-semibold text-sky-700 dark:text-sky-400">Madeira</span> e{' '}
              <span className="font-semibold text-sky-700 dark:text-sky-400">Tapajós</span>.{' '}
              <span className="text-slate-500 dark:text-slate-400">
                Cadeia de previsão integrada.
              </span>
            </p>

            {/* Team */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  Membros da equipe
                </span>
                <span className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
              </div>

              <div className="flex flex-wrap justify-center gap-1.5">
                {TEAM_MEMBERS.map(({ name, color }) => (
                  <div
                    key={name}
                    title={name}
                    className="flex items-center gap-1.5 rounded-full border border-slate-100 bg-slate-50 px-2.5 py-1 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${color} text-[9px] font-bold text-white`}
                    >
                      {getInitials(name)}
                    </div>
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      {name.split(' ')[0]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={() => setOpen(false)}
              className="w-full rounded-xl bg-sky-600 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-sky-700 active:scale-[0.98] dark:bg-sky-500 dark:hover:bg-sky-600"
            >
              Acessar plataforma →
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
