import { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { api } from '../api/client';

export default function Success() {
  const location = useLocation();
  const total = location.state?.total || 0;
  const orderId = location.state?.orderId || '';
  const [pending, setPending] = useState(!!location.state?.pending);
  const sandbox = location.state?.sandbox;
  const transactionId = location.state?.transactionId;
  const [status, setStatus] = useState(location.state?.paymentStatus || (pending ? 'awaiting_confirmation' : 'paid'));

  useEffect(() => {
    if (!pending || !transactionId) return undefined;
    let cancelled = false;
    const tick = async () => {
      try {
        const s = await api.payments.status(transactionId);
        if (cancelled) return;
        setStatus(s.status);
        if (s.status === 'completed') setPending(false);
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
    <div className="min-h-[70vh] bg-white px-6 py-16 text-center">
      <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${pending ? 'bg-amber-50' : 'bg-green-50'}`}>
        {pending ? <span className="text-2xl">…</span> : <span className="text-2xl text-green-600">✓</span>}
      </div>
      <h2 className="text-2xl font-semibold mb-2">{pending ? 'Payment pending' : 'Payment confirmed'}</h2>
      <p className="text-gray-500 mb-2">
        {pending
          ? `Complete payment of P${total} with your provider. This page will update when confirmed.`
          : `Payment of P${total} has been confirmed.`}
      </p>
      {sandbox && <p className="text-xs text-amber-600 mb-2">Sandbox auto-complete (development only)</p>}
      {orderId && <p className="text-sm text-gray-400 mb-2">Order: {orderId}</p>}
      <p className="text-xs text-gray-400 mb-8">Status: {status}</p>
      <div className="space-y-3">
        <Link to="/orders" className="block w-full bg-gray-900 text-white py-3 rounded-xl font-medium">
          View my orders
        </Link>
        <Link to="/dashboard" className="block w-full border py-3 rounded-xl font-medium">
          Back to groups
        </Link>
      </div>
    </div>
  );
}
