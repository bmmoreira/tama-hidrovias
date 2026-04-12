import { getStations } from '@/lib/strapi';
import DashboardOverviewClient from './DashboardOverviewClient';

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

  return <DashboardOverviewClient totalStations={totalStations} />;
}
