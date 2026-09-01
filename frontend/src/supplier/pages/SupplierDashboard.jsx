import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { ErrorState, Spinner, Stat } from '../../components/ui';
import { money } from '../../lib/format';
import { useAuth } from '../../hooks/useAuth';

export default function SupplierDashboard() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useQuery('wholesaler-dash', () => api.supplier.dashboard());
  const groups = useQuery('wholesaler-groups', () => api.supplier.groups());
  const orders = useQuery('wholesaler-orders', () => api.supplier.orders());

  if (isLoading) return <Spinner label="Loading wholesaler overview" />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const awaiting = (orders.data || []).filter((o) => ['paid', 'group_filling', 'ordered'].includes(o.status)).slice(0, 5);

  return (
    <div>
      <p className="label">Wholesaler</p>
      <h1 className="page-title mt-1">{user?.name || user?.business_name || 'Overview'}</h1>
      <p className="text-sm text-muted mt-1 mb-6">Live figures from your groups and orders. Payout is merchandise minus platform fee on paid orders.</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Buying groups" value={data.groups} hint={`${data.openGroups ?? '—'} open`} />
        <Stat label="Orders" value={data.orders} hint={`${data.pendingOrders ?? 0} awaiting payment`} />
        <Stat label="Paid orders" value={data.paidOrders ?? '—'} />
        <Stat label="Est. payout" value={money(data.estimatedPayout)} />
      </div>
      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        <Link to="/wholesaler/groups" className="btn-secondary">Buying groups</Link>
        <Link to="/wholesaler/catalogue" className="btn-secondary">Upload catalogue</Link>
        <Link to="/wholesaler/deliveries" className="btn-secondary">Deliveries</Link>
      </div>
      <h2 className="font-bold mb-3">Orders needing fulfilment</h2>
      <div className="space-y-2">
        {awaiting.length === 0 && <p className="text-sm text-muted">No paid orders waiting on you right now.</p>}
        {awaiting.map((o) => (
          <Link key={o.id} to={`/wholesaler/orders/${o.id}`} className="card flex justify-between">
            <div>
              <div className="font-semibold">{o.product_name}</div>
              <div className="text-xs text-muted">{o.order_number} · {o.client_name || 'Client'}</div>
            </div>
            <div className="text-sm font-medium">{o.status}</div>
          </Link>
        ))}
      </div>
      {groups.data && (
        <p className="text-xs text-muted mt-6">{groups.data.length} groups in your catalogue.</p>
      )}
    </div>
  );
}
