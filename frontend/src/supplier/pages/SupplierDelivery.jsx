import { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { api } from '../../api/client';
import { EmptyState, ErrorState, Spinner, StatusBadge } from '../../components/ui';
import { formatDate } from '../../lib/format';

export default function SupplierDelivery() {
  const qc = useQueryClient();
  const list = useQuery('wholesaler-deliveries', () => api.supplier.deliveries());
  const groups = useQuery('wholesaler-groups', () => api.supplier.groups());
  const [groupId, setGroupId] = useState('');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      await api.supplier.deliver({ groupId: groupId || undefined, notes });
      setMsg('Delivery recorded');
      setNotes('');
      qc.invalidateQueries('wholesaler-deliveries');
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="page-title mb-5">Deliveries</h1>
      <form onSubmit={submit} className="card space-y-3 mb-6 max-w-lg">
        <div className="font-semibold">Record a dispatch</div>
        <select className="input-field" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">Select a group (optional)</option>
          {(groups.data || []).map((g) => (
            <option key={g.id} value={g.id}>{g.product_name}</option>
          ))}
        </select>
        <textarea className="input-field" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save delivery'}</button>
        {msg && <p className="text-sm">{msg}</p>}
      </form>
      {list.isLoading && <Spinner />}
      {list.error && <ErrorState message={list.error.message} onRetry={list.refetch} />}
      {!list.isLoading && !list.data?.length && <EmptyState title="No deliveries recorded" />}
      <div className="space-y-2">
        {(list.data || []).map((d) => (
          <div key={d.id} className="card">
            <div className="flex justify-between">
              <div>
                <div className="font-semibold">{d.product_name || d.order_number || 'Delivery'}</div>
                <div className="text-xs text-muted">{d.pickup_location || '—'} · {formatDate(d.created_at)}</div>
                {d.notes && <p className="text-sm mt-1">{d.notes}</p>}
              </div>
              <StatusBadge tone={d.status === 'pending' ? 'warn' : 'ok'}>{d.status}</StatusBadge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
