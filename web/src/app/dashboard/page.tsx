import Link from 'next/link';
import { Radio, BarChart2, Layers, Activity } from 'lucide-react';
import { getStations, getMeasurements, getForecasts } from '@/lib/strapi';
import SummaryCard from '@/components/SummaryCard';
import DashboardCharts from './DashboardCharts';

async function fetchSummary() {
  const [stationsRes] = await Promise.allSettled([
    getStations({ 'pagination[pageSize]': '1' }),
  ]);

  const totalStations =
    stationsRes.status === 'fulfilled'
      ? stationsRes.value.meta.pagination.total
      : 0;

  return { totalStations };
}

export default async function DashboardPage() {
  const { totalStations } = await fetchSummary();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Visão Geral</h1>
        <p className="text-sm text-gray-500">
          Bem-vindo ao painel de controle do Tama Hidrovias
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Total de Estações"
          value={totalStations}
          Icon={Radio}
          color="blue"
          description="Todas as fontes"
        />
        <SummaryCard
          title="Medições Recentes"
          value="—"
          Icon={Activity}
          color="green"
          description="Últimas 24 horas"
        />
        <SummaryCard
          title="Previsões Ativas"
          value="—"
          Icon={BarChart2}
          color="amber"
          description="Próximos 15 dias"
        />
        <SummaryCard
          title="Camadas Climáticas"
          value="—"
          Icon={Layers}
          color="purple"
          description="Disponíveis"
        />
      </div>

      {/* Recent chart */}
      <DashboardCharts />

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickLinks.map((ql) => (
          <Link
            key={ql.href}
            href={ql.href}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md"
          >
            <div className="mb-2 inline-flex rounded-lg bg-blue-50 p-2 text-blue-700">
              <ql.Icon className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-gray-800">{ql.label}</h3>
            <p className="mt-0.5 text-xs text-gray-400">{ql.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

const quickLinks = [
  {
    href: '/dashboard/stations',
    label: 'Estações',
    description: 'Gerenciar estações e criar virtuais',
    Icon: Radio,
  },
  {
    href: '/dashboard/forecasts',
    label: 'Previsões',
    description: 'Visualizar previsões por estação',
    Icon: BarChart2,
  },
  {
    href: '/dashboard/climate-layers',
    label: 'Camadas Climáticas',
    description: 'GeoTIFFs e layers de clima',
    Icon: Layers,
  },
  {
    href: '/map',
    label: 'Mapa Público',
    description: 'Ver mapa interativo de estações',
    Icon: Activity,
  },
];
