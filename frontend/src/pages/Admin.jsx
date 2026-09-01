import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { ErrorState, Spinner, Stat } from '../components/ui';
import { money } from '../lib/format';

export default function Admin() {
  const { data: stats, isLoading, error, refetch } = useQuery('admin-stats', () => api.admin.stats());

  if (isLoading) return <Spinner label="Loading admin overview" />;
  if (error) return <ErrorState message={error.message || 'Admin access denied.'} onRetry={refetch} />;

  return (
    <div>
      <h1 className="page-title mb-1">Platform overview</h1>
      <p className="text-sm text-muted mb-6">Figures come from live admin APIs. Nothing here is estimated.</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Stat label="Users" value={stats.totalUsers} />
        <Stat label="Completed payments" value={money(stats.totalRevenue)} />
        <Stat label="Open groups" value={stats.activeGroups} />
        <Stat label="Avg fill" value={`${stats.avgFillRate}%`} />
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <Link to="/admin/clients" className="card hover:shadow-lift">
          <div className="font-bold">Clients</div>
          <p className="text-sm text-muted mt-1">Shops, agents, wholesalers and roles.</p>
        </Link>
        <Link to="/admin/groups" className="card hover:shadow-lift">
          <div className="font-bold">Buying groups</div>
          <p className="text-sm text-muted mt-1">Capacity, status and wholesaler.</p>
        </Link>
        <Link to="/admin/revenue" className="card hover:shadow-lift">
          <div className="font-bold">Revenue</div>
          <p className="text-sm text-muted mt-1">Completed payments and fees by month.</p>
        </Link>
      </div>
    </div>
  );
}
