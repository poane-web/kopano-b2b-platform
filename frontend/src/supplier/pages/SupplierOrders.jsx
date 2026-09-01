import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { EmptyState, ErrorState, Spinner, StatusBadge } from '../../components/ui';
import { formatDate, money, ORDER_LABELS, ORDER_TONE } from '../../lib/format';

export default function SupplierOrders() {
  const { data: orders, isLoading, error, refetch } = useQuery('wholesaler-orders', () => api.supplier.orders());
  if (isLoading) return <Spinner label="Loading orders" />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div>
      <h1 className="page-title mb-5">Orders</h1>
      {!orders?.length && <EmptyState title="No orders yet" body="Orders appear when clients join your groups." />}
      <div className="space-y-2">
        {(orders || []).map((o) => (
          <Link key={o.id} to={`/wholesaler/orders/${o.id}`} className="card block">
            <div className="flex justify-between gap-3">
              <div>
                <div className="font-bold">{o.product_name}</div>
                <div className="text-xs text-muted">
                  {o.order_number} · {o.client_name || 'Client'} · qty {o.quantity}
                </div>
              </div>
              <StatusBadge tone={ORDER_TONE[o.status] || 'neutral'}>{ORDER_LABELS[o.status] || o.status}</StatusBadge>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-muted">{formatDate(o.created_at)}</span>
              <span className="font-semibold">{o.total_amount != null ? money(o.total_amount) : money(Number(o.unit_price) * o.quantity)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
