import { useQuery } from 'react-query';
import { api } from '../api/client';
import { EmptyState, ErrorState, Spinner, StatusBadge } from '../components/ui';
import { money } from '../lib/format';

export default function AdminGroups() {
  const { data, isLoading, error, refetch } = useQuery('admin-groups', () => api.admin.groups());
  if (isLoading) return <Spinner label="Loading groups" />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div>
      <h1 className="page-title mb-5">Buying groups</h1>
      {!data?.length && <EmptyState title="No groups" />}
      <div className="space-y-3">
        {(data || []).map((g) => (
          <div key={g.id} className="card">
            <div className="flex justify-between gap-3">
              <div>
                <div className="font-bold">{g.product_name}</div>
                <div className="text-sm text-muted">{g.supplier_name} · {g.member_count} shops</div>
              </div>
              <StatusBadge>{g.status}</StatusBadge>
            </div>
            <div className="text-sm mt-2">
              {money(g.unit_price)} · {g.current_quantity}/{g.target_quantity} {g.unit}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
