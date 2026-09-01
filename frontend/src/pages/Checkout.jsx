import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { isPaymentConfirmed, money } from '../lib/format';

const METHODS = [
  { id: 'orange_money', label: 'Orange Money', hint: 'Recommended in Botswana' },
  { id: 'mascom_wallet', label: 'Mascom wallet', hint: 'Label only — not yet connected' },
  { id: 'card', label: 'Card (DPO)', hint: 'Requires merchant activation' },
];

export default function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const group = location.state?.group;
  const initialQty = location.state?.quantity || 1;
  const [qty, setQty] = useState(initialQty);
  const [method, setMethod] = useState('orange_money');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState(null);
  const online = useOnlineStatus();

  useEffect(() => {
    const saved = sessionStorage.getItem('kopano_checkout');
    if (saved && !order) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.orderId) setOrder(parsed);
      } catch {
        /* ignore */
      }
    }
  }, [order]);

  if (!group && !order) {
    return (
      <div className="card">
        <p className="font-semibold">No group selected</p>
        <button type="button" className="btn-primary mt-4" onClick={() => navigate('/buy')}>
          Browse groups
        </button>
      </div>
    );
  }

  const g = group || {};
  const maxQty = Math.max(1, g.remaining_quantity ?? 99);
  const estUnit = Number(g.unit_price || 0);
  const estRetail = Number(g.retail_price || 0);
  const estSubtotal = qty * estUnit;
  const estSavings = qty * (estRetail - estUnit);
  const serverTotal = order?.breakdown?.grandTotal ?? order?.total;

  async function handlePay() {
    if (!online) {
      setError('You are offline. Payment cannot be started until you reconnect.');
      return;
    }
    if (method !== 'orange_money') {
      setError('Only Orange Money is available until other providers are activated.');
      return;
    }
    setPaying(true);
    setError('');
    try {
      let current = order;
      if (!current) {
        const created = await api.orders.create({
          groupId: g.id,
          quantity: qty,
          paymentMethod: method,
        });
        current = {
          orderId: created.id,
          breakdown: created.breakdown,
          total: created.breakdown?.grandTotal ?? created.total_amount,
        };
        setOrder(current);
        sessionStorage.setItem('kopano_checkout', JSON.stringify(current));
      }

      const idempotencyKey = current.idempotencyKey || crypto.randomUUID();
      current.idempotencyKey = idempotencyKey;
      sessionStorage.setItem('kopano_checkout', JSON.stringify(current));

      const pay = await api.payments.orangeMoney(current.orderId, { idempotencyKey });
      sessionStorage.removeItem('kopano_checkout');
      if (pay.paymentUrl) {
        window.location.href = pay.paymentUrl;
        return;
      }
      navigate('/success', {
        state: {
          total: current.total,
          orderId: current.orderId,
          pending: !isPaymentConfirmed(pay.status),
          sandbox: !!pay.sandbox,
          transactionId: pay.transactionId,
          paymentStatus: pay.status,
        },
      });
    } catch (err) {
      setError(err.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="pb-32 lg:pb-8 max-w-lg">
      <h2 className="page-title mb-1">Checkout</h2>
      <p className="text-sm text-muted mb-5">
        Capacity is reserved when you place the order. Final total comes from the server.
      </p>
      {!online && (
        <div className="mb-4 p-3 rounded-lg bg-amber-soft text-amber text-sm">
          Offline — payments are disabled until you reconnect.
        </div>
      )}
      {error && <div className="mb-4 p-3 rounded-lg bg-danger-soft text-danger text-sm">{error}</div>}

      <div className="card mb-4">
        <div className="font-bold">{g.product_name}</div>
        <div className="text-sm text-muted">
          {g.supplier_name} · {money(estUnit)} / unit
        </div>
        {!order && (
          <div className="flex items-center gap-3 my-3">
            <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} className="w-11 h-11 rounded-lg bg-clay font-bold">
              −
            </button>
            <span className="text-lg font-extrabold w-8 text-center">{qty}</span>
            <button type="button" onClick={() => setQty(Math.min(maxQty, qty + 1))} className="w-11 h-11 rounded-lg bg-clay font-bold">
              +
            </button>
          </div>
        )}
        <div className="flex justify-between text-sm pt-3 border-t border-line">
          <span className="text-muted">Est. save vs retail</span>
          <span className="text-success font-semibold">{money(estSavings)}</span>
        </div>
        {order?.breakdown && (
          <div className="mt-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted">Subtotal</span>
              <span>{money(order.breakdown.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Platform fee</span>
              <span>{money(order.breakdown.platformFee)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Delivery</span>
              <span>{money(order.breakdown.deliveryFee)}</span>
            </div>
            <div className="flex justify-between font-bold pt-1">
              <span>Total</span>
              <span>{money(order.breakdown.grandTotal)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="label mb-2">Payment method</div>
      <div className="flex flex-col gap-2 mb-5">
        {METHODS.map((m) => (
          <label
            key={m.id}
            className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer ${
              method === m.id ? 'border-forest bg-success-soft/40' : 'border-line bg-paper'
            }`}
          >
            <input type="radio" name="pay" checked={method === m.id} onChange={() => setMethod(m.id)} className="mt-1 accent-forest" />
            <span>
              <span className="font-semibold block">{m.label}</span>
              <span className="text-xs text-muted">{m.hint}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="fixed bottom-0 inset-x-0 lg:static bg-paper border-t border-line lg:border-0 p-4">
        <div className="flex justify-between mb-3 max-w-lg mx-auto">
          <span className="text-muted">Due now</span>
          <span className="text-xl font-extrabold">{money(serverTotal ?? estSubtotal)}</span>
        </div>
        <button type="button" onClick={handlePay} disabled={paying || !online} className="btn-primary max-w-lg mx-auto">
          {paying ? 'Processing…' : 'Pay with Orange Money'}
        </button>
      </div>
    </div>
  );
}
