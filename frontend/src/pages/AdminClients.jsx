import { useQuery } from 'react-query';
import { api } from '../api/client';
import { EmptyState, ErrorState, Spinner, StatusBadge } from '../components/ui';
import { formatDate, money } from '../lib/format';

export default function AdminClients() {
  const { data, isLoading, error, refetch } = useQuery('admin-users', () => api.admin.users());

  if (isLoading) return <Spinner label="Loading clients" />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div>
      <h1 className="page-title mb-1">Clients</h1>
      <p className="text-sm text-muted mb-5">All registered accounts. Role is enforced by the API, not this screen.</p>
      {!data?.length && <EmptyState title="No users yet" />}
      <div className="hidden md:block overflow-x-auto card p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-muted border-b border-line">
            <tr>
              <th className="p-3">Business</th>
              <th className="p-3">Role</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Orders</th>
              <th className="p-3">Savings</th>
              <th className="p-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="p-3 font-medium">{u.business_name}</td>
                <td className="p-3 capitalize">{u.role}</td>
                <td className="p-3">{u.phone}</td>
                <td className="p-3">{u.order_count}</td>
                <td className="p-3">{money(u.total_savings)}</td>
                <td className="p-3 text-muted">{formatDate(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="md:hidden space-y-2">
        {(data || []).map((u) => (
          <div key={u.id} className="card">
            <div className="font-bold">{u.business_name}</div>
            <div className="text-sm text-muted">{u.phone}</div>
            <div className="mt-2 flex gap-2">
              <StatusBadge>{u.role}</StatusBadge>
              <StatusBadge tone={u.account_status === 'active' ? 'ok' : 'warn'}>{u.account_status}</StatusBadge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
