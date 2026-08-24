import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

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

  if (!group && !order) return <div className="p-4">No group selected</div>;

  const g = group || {};
  const maxQty = Math.max(1, g.remaining_quantity ?? 99);
  const estUnit = Number(g.unit_price || 0);
  const estRetail = Number(g.retail_price || 0);
  const estSubtotal = qty * estUnit;
  const estSavings = qty * (estRetail - estUnit);

  async function handlePay() {
    if (!online) {
      setError('You are offline. Payment cannot be started until you reconnect.');
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

      if (method === 'orange_money') {
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
            pending: pay.status !== 'paid',
            sandbox: !!pay.sandbox,
            transactionId: pay.transactionId,
            paymentStatus: pay.status,
          },
        });
        return;
      }

      navigate('/success', {
        state: { total: current.total, orderId: current.orderId, pending: true },
      });
    } catch (err) {
      setError(err.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="pb-24">
      <h2 className="text-xl font-medium mb-5">Place order</h2>
      {!online && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 text-amber-800 text-sm">
          Offline — payments are disabled until you reconnect.
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-100">{error}</div>
      )}

      <div className="bg-white border rounded-xl p-4 mb-4">
        <div className="flex justify-between mb-2">
          <span className="text-gray-500">{g.product_name}</span>
          <span className="font-medium">P{estUnit}/unit</span>
        </div>
        <div className="flex items-center gap-3 my-3">
          <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} className="w-8 h-8 rounded-lg bg-gray-100 border">
            −
          </button>
          <span className="text-lg font-medium w-10 text-center">{qty}</span>
          <button type="button" onClick={() => setQty(Math.min(maxQty, qty + 1))} className="w-8 h-8 rounded-lg bg-gray-100 border">
            +
          </button>
        </div>
        <div className="flex justify-between pt-3 border-t text-sm">
          <span className="text-gray-500">Est. save vs retail</span>
          <span className="text-green-600 font-medium">P{estSavings.toFixed(2)}</span>
        </div>
        <p className="text-xs text-gray-400 mt-2">Final total is calculated by the server (includes fees).</p>
      </div>

      <div className="text-sm font-medium mb-2.5">Payment method</div>
      <div className="flex flex-col gap-2 mb-5">
        {['orange_money', 'mascom_wallet', 'card'].map((m) => (
          <label
            key={m}
            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer ${
              method === m ? 'border-gray-900 bg-gray-50' : 'border-gray-200'
            }`}
          >
            <input type="radio" name="pay" checked={method === m} onChange={() => setMethod(m)} className="accent-gray-900" />
            <span className="font-medium capitalize">{m.replace('_', ' ')}</span>
          </label>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t max-w-lg mx-auto">
        <div className="flex justify-between mb-3">
          <span className="text-gray-500">Est. merchandise</span>
          <span className="text-xl font-medium">P{estSubtotal.toFixed(2)}</span>
        </div>
        <button
          type="button"
          onClick={handlePay}
          disabled={paying || !online}
          className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium disabled:opacity-50"
        >
          {paying ? 'Processing...' : 'Pay now'}
        </button>
      </div>
    </div>
  );
}
