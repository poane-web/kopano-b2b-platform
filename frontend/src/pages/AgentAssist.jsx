import { useState } from 'react';
import { api } from '../api/client';
import { StatusBadge } from '../components/ui';

export default function AgentAssist() {
  const [orderId, setOrderId] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const res = await api.agent.assistOrder(orderId.trim());
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="page-title mb-1">Assisted order</h1>
      <p className="text-sm text-muted mb-5">
        Look up an order placed by a shop you activated. You can only see orders for your shops.
      </p>
      {error && <div className="bg-danger-soft text-danger p-3 rounded-lg text-sm mb-3">{error}</div>}
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="input-field" placeholder="Order ID" value={orderId} onChange={(e) => setOrderId(e.target.value)} required />
        <button className="btn-primary" disabled={busy}>{busy ? 'Looking up…' : 'Assist'}</button>
      </form>
      {result && (
        <div className="card mt-4">
          <div className="font-bold">{result.orderNumber}</div>
          <div className="mt-2"><StatusBadge>{result.status}</StatusBadge></div>
          {result.assisted && <p className="text-sm text-muted mt-2">This order belongs to one of your shops.</p>}
        </div>
      )}
    </div>
  );
}
