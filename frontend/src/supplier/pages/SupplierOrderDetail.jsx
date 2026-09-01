import { useParams, Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { api } from '../../api/client';
import { ErrorState, Spinner, StatusBadge } from '../../components/ui';
import { formatDate, money, ORDER_LABELS, ORDER_TONE } from '../../lib/format';

export default function SupplierOrderDetail() {
  const { id } = useParams();
  const { data: o, isLoading, error, refetch } = useQuery(['wholesaler-order', id], () => api.supplier.order(id));
  if (isLoading) return <Spinner />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;
  if (!o) return <ErrorState message="Order not found." />;

  return (
    <div className="max-w-lg">
      <Link to="/wholesaler/orders" className="text-sm text-muted">← Orders</Link>
      <h1 className="page-title mt-3">{o.product_name}</h1>
      <p className="text-sm text-muted font-mono">{o.order_number}</p>
      <div className="mt-4"><StatusBadge tone={ORDER_TONE[o.status] || 'neutral'}>{ORDER_LABELS[o.status] || o.status}</StatusBadge></div>
      <div className="card mt-4 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-muted">Client</span><span>{o.client_name || '—'}</span></div>
        <div className="flex justify-between"><span className="text-muted">Location</span><span>{o.client_location || '—'}</span></div>
        <div className="flex justify-between"><span className="text-muted">Quantity</span><span>{o.quantity}</span></div>
        <div className="flex justify-between"><span className="text-muted">Unit price</span><span>{money(o.unit_price)}</span></div>
        <div className="flex justify-between font-semibold"><span>Total</span><span>{money(o.total_amount)}</span></div>
        <div className="flex justify-between"><span className="text-muted">Placed</span><span>{formatDate(o.created_at)}</span></div>
        <div className="flex justify-between"><span className="text-muted">Pickup</span><span>{o.pickup_location || '—'}</span></div>
      </div>
    </div>
  );
}
