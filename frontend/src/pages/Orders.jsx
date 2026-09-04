import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { EmptyState, ErrorState, Spinner, StatusBadge } from '../components/ui';
import { formatDate, money, ORDER_LABELS, ORDER_TONE } from '../lib/format';

export default function Orders() {
  const { data: orders, isLoading, error, refetch } = useQuery('my-orders', () => api.orders.my(), {
    staleTime: 10_000,
  });

  return (
    <div>
      <h1 className="page-title mb-1">Orders</h1>
      <p className="text-sm text-muted mb-5">Payment, group fill and pickup status for this shop.</p>
      {isLoading && <Spinner label="Loading orders" />}
      {error && <ErrorState message="Could not load orders." onRetry={refetch} />}
      {!isLoading && !error && (!orders || orders.length === 0) && (
        <EmptyState
          title="No orders yet"
          body="Browse groups to start saving on stock."
          action={
            <Link to="/buy" className="btn-primary max-w-xs mx-auto">
              Find products
            </Link>
          }
        />
      )}
      <div className="space-y-3">
        {(orders || []).map((order) => (
          <Link key={order.id} to={`/orders/${order.id}`} className="card block">
            <div className="flex justify-between text-xs text-muted mb-2">
              <span className="font-mono">{order.order_number}</span>
              <span>{formatDate(order.created_at)}</span>
            </div>
            <div className="font-bold">{order.product_name}</div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-sm text-muted">Qty {order.quantity}</span>
              <span className="font-semibold">{money(order.total_amount)}</span>
            </div>
            <div className="mt-3">
              <StatusBadge tone={ORDER_TONE[order.status] || 'neutral'}>
                {ORDER_LABELS[order.status] || order.status}
              </StatusBadge>
            </div>
            {order.pickup_code && order.status === 'ready_pickup' && (
              <div className="mt-3 p-3 bg-clay rounded-lg">
                <div className="label">Pickup code</div>
                <div className="text-lg font-mono font-bold tracking-wider">{order.pickup_code}</div>
                <div className="text-xs text-muted mt-1">{order.pickup_location}</div>
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
