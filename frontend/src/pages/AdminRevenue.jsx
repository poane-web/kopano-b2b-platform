import { useQuery } from 'react-query';
import { api } from '../api/client';
import { EmptyState, ErrorState, Spinner } from '../components/ui';
import { formatDate, money } from '../lib/format';

export default function AdminRevenue() {
  const { data, isLoading, error, refetch } = useQuery('admin-revenue', () => api.admin.revenue());
  if (isLoading) return <Spinner label="Loading revenue" />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div>
      <h1 className="page-title mb-1">Revenue</h1>
      <p className="text-sm text-muted mb-5">Completed transactions only, grouped by month.</p>
      {!data?.length && <EmptyState title="No completed payments yet" />}
      <div className="space-y-2">
        {(data || []).map((row) => (
          <div key={row.month} className="card flex justify-between">
            <div>
              <div className="font-semibold">{formatDate(row.month)}</div>
              <div className="text-xs text-muted">Fees {money(row.fees)}</div>
            </div>
            <div className="font-extrabold">{money(row.payments)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
