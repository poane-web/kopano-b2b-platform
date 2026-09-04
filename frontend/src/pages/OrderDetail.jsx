import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { api } from '../api/client';
import { ErrorState, Spinner, StatusBadge } from '../components/ui';
import { formatDate, isPaymentConfirmed, money, ORDER_LABELS, ORDER_TONE } from '../lib/format';

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: o, isLoading, error, refetch } = useQuery(['order', id], () => api.orders.get(id));
  const [busy, setBusy] = useState('');
  const [actionError, setActionError] = useState('');

  async function resumePay() {
    setBusy('pay');
    setActionError('');
    try {
      const pay = await api.payments.orangeMoney(o.id, { idempotencyKey: crypto.randomUUID() });
      if (pay.paymentUrl) {
        window.location.href = pay.paymentUrl;
        return;
      }
      navigate('/success', {
        state: {
          total: o.total_amount,
          orderId: o.id,
          pending: !isPaymentConfirmed(pay.status),
          sandbox: !!pay.sandbox,
          transactionId: pay.transactionId,
          paymentStatus: pay.status,
        },
      });
    } catch (err) {
      setActionError(err.message || 'Could not start payment');
    } finally {
      setBusy('');
    }
  }

  async function cancelOrder() {
    if (!window.confirm('Cancel this unpaid order and release the reserved quantity?')) return;
    setBusy('cancel');
    setActionError('');
    try {
      await api.orders.cancel(o.id);
      await refetch();
    } catch (err) {
      setActionError(err.message || 'Could not cancel');
    } finally {
      setBusy('');
    }
  }

  if (isLoading) return <Spinner label="Loading order" />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;
  if (!o) return <ErrorState message="Order not found." />;

  const unpaid = o.status === 'pending_payment' || o.status === 'payment_initiated';

  return (
    <div className="max-w-lg">
      <button type="button" onClick={() => navigate('/orders')} className="text-sm text-muted font-medium">
        ← Orders
      </button>
      <h1 className="page-title mt-3">{o.product_name}</h1>
      <p className="text-sm text-muted font-mono">{o.order_number}</p>
      <div className="mt-4">
        <StatusBadge tone={ORDER_TONE[o.status] || 'neutral'}>{ORDER_LABELS[o.status] || o.status}</StatusBadge>
      </div>
      <div className="card mt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Quantity</span>
          <span>{o.quantity} {o.unit}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Unit price</span>
          <span>{money(o.unit_price)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Platform fee</span>
          <span>{money(o.platform_fee)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Delivery</span>
          <span>{money(o.delivery_fee)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>{money(o.total_amount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Placed</span>
          <span>{formatDate(o.created_at)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Pickup</span>
          <span>{o.pickup_location || '—'}</span>
        </div>
        {o.pickup_code && (
          <div className="flex justify-between">
            <span className="text-muted">Pickup code</span>
            <span className="font-mono font-bold">{o.pickup_code}</span>
          </div>
        )}
      </div>
      {actionError && (
        <div className="mt-4 p-3 rounded-lg bg-danger-soft text-danger text-sm">{actionError}</div>
      )}
      {unpaid && (
        <div className="mt-4 space-y-2">
          <button type="button" className="btn-primary" disabled={!!busy} onClick={resumePay}>
            {busy === 'pay' ? 'Starting payment…' : 'Pay with Orange Money'}
          </button>
          <button type="button" className="btn-secondary" disabled={!!busy} onClick={cancelOrder}>
            {busy === 'cancel' ? 'Cancelling…' : 'Cancel unpaid order'}
          </button>
        </div>
      )}
    </div>
  );
}
