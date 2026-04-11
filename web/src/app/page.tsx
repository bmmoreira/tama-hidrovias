import Link from 'next/link';
import { Droplets, Map, LayoutDashboard, ArrowRight, SatelliteIcon } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col">
      {/* Hero */}
      <section className="relative flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-blue-900 via-green-700 to-cyan-600 px-6 py-24 text-white">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            TaMa Hidrovias
          </h1>
          <p className="mb-8 text-lg text-blue-100 sm:text-xl">
            Plataforma de monitoramento hidrológico para hidrovias na região dos rios Madeira e Tapajós. Cadeia de previsão integrada.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/map"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-blue-900 shadow-lg transition hover:bg-blue-50 hover:shadow-xl"
            >
              <Map className="h-5 w-5" />
              Ver Mapa Público
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-white/60 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition hover:border-white hover:bg-white/10"
            >
              <LayoutDashboard className="h-5 w-5" />
              Painel de Controle
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="bg-white px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-10 text-center text-2xl font-semibold text-gray-800 sm:text-3xl">
            Recursos da Plataforma
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-gray-100 bg-gray-50 p-6 shadow-sm transition hover:shadow-md"
              >
                <div className="mb-3 inline-flex rounded-xl bg-blue-100 p-3 text-blue-700">
                  <f.Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-gray-800">
                  {f.title}
                </h3>
                <p className="text-sm text-gray-500">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-400">
        <p>
          © {new Date().getFullYear()} TaMa Hidrovias · Dados hidrológicos
          abertos para o Brasil
        </p>
      </footer>
    </main>
  );
}

const features = [
  {
    Icon: Map,
    title: 'Mapa Interativo',
    description:
      'Visualize estações virtuais hidrométricas os rios Madeira e Tapajós com dados e séries históricas.',
  },
  {
    Icon: SatelliteIcon,
    title: 'Medições em Altimetria',
    description:
      'Acesse dados de nível d\'água e altimetria para monitoramento contínuo das hidrovias.',
  },
  {
    Icon: Droplets,
    title: 'Previsões Hidrológicas',
    description:
      'Previsões de 1 dia a 6 meses geradas por modelos numéricos para planejamento de recursos hídricos.',
  },
] as const;
