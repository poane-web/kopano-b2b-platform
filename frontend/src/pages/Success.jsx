import { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { api } from '../api/client';
import { isPaymentConfirmed, money } from '../lib/format';

export default function Success() {
  const location = useLocation();
  const total = location.state?.total || 0;
  const orderId = location.state?.orderId || '';
  const sandbox = location.state?.sandbox;
  const transactionId = location.state?.transactionId;
  const initialStatus = location.state?.paymentStatus || (location.state?.pending ? 'awaiting_confirmation' : 'paid');
  const [status, setStatus] = useState(initialStatus);
  const [pending, setPending] = useState(!isPaymentConfirmed(initialStatus) && !!location.state?.pending);

  useEffect(() => {
    if (!pending || !transactionId) return undefined;
    let cancelled = false;
    const tick = async () => {
      try {
        const s = await api.payments.status(transactionId);
        if (cancelled) return;
        setStatus(s.status);
        if (isPaymentConfirmed(s.status)) setPending(false);
      } catch {
        /* keep pending */
      }
    };
    tick();
    const id = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pending, transactionId]);

  return (
    <div className="max-w-md mx-auto text-center py-10">
      <div
        className={`w-16 h-16 rounded-full grid place-items-center mx-auto mb-6 ${
          pending ? 'bg-amber-soft text-amber' : 'bg-success-soft text-success'
        }`}
      >
        <span className="text-2xl font-bold">{pending ? '…' : '✓'}</span>
      </div>
      <h2 className="page-title mb-2">{pending ? 'Payment pending' : 'Payment confirmed'}</h2>
      <p className="text-muted mb-2">
        {pending
          ? `Complete ${money(total)} with your provider. This page updates when Kopano receives a verified notification.`
          : `${money(total)} has been confirmed.`}
      </p>
      {sandbox && <p className="text-xs text-amber mb-2">Sandbox auto-complete (development only)</p>}
      {orderId && <p className="text-sm text-muted mb-2">Order {orderId}</p>}
      <p className="text-xs text-muted mb-8">Status: {status}</p>
      <div className="space-y-3">
        <Link to="/orders" className="btn-primary">
          View my orders
        </Link>
        <Link to="/buy" className="btn-secondary">
          Back to groups
        </Link>
      </div>
    </div>
  );
}
