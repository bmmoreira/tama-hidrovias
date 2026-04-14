import { getStations } from '@/lib/strapi';
import DashboardOverviewClient from './DashboardOverviewClient';

/**
 * Fetch a lightweight summary of dashboard metrics for the overview
 * page. Currently only loads the total number of registered
 * stations.
 */
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

/**
 * Main dashboard overview route (``/dashboard``).
 *
 * This server component loads a small summary payload and delegates
 * the actual UI rendering to {@link DashboardOverviewClient}.
 */
export default async function DashboardPage() {
  const { totalStations } = await fetchSummary();

  return <DashboardOverviewClient totalStations={totalStations} />;
}
