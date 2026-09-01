import { useQuery } from 'react-query';
import { api } from '../../api/client';
import { EmptyState, ErrorState, Spinner, StatusBadge } from '../../components/ui';

export default function SupplierAnalytics() {
  const { data, isLoading, error, refetch } = useQuery('wholesaler-analytics', () => api.supplier.analytics());
  if (isLoading) return <Spinner />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const groups = data?.groups || [];
  return (
    <div>
      <h1 className="page-title mb-1">Analytics</h1>
      <p className="text-sm text-muted mb-5">Fill and order counts from your buying groups. Period: {data?.period || '—'}</p>
      {!groups.length && <EmptyState title="No group data yet" />}
      <div className="space-y-2">
        {groups.map((g) => {
          const pct = g.target_quantity ? Math.round((g.current_quantity / g.target_quantity) * 100) : 0;
          return (
            <div key={g.id} className="card">
              <div className="flex justify-between">
                <div className="font-bold">{g.product_name}</div>
                <StatusBadge>{g.status}</StatusBadge>
              </div>
              <div className="h-1.5 bg-clay rounded-full overflow-hidden mt-3">
                <div className="h-full bg-forest" style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <div className="text-sm text-muted mt-1">
                {g.current_quantity}/{g.target_quantity} · {g.order_count} orders · {pct}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
