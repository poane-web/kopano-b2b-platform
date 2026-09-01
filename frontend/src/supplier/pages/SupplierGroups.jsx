import { useQuery, useQueryClient } from 'react-query';
import { api } from '../../api/client';
import { EmptyState, ErrorState, Spinner, StatusBadge } from '../../components/ui';
import { formatDeadline, money } from '../../lib/format';
import { useState } from 'react';

export default function SupplierGroups() {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery('wholesaler-groups', () => api.supplier.groups());
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState('');

  async function confirm(id) {
    setBusy(id);
    setMsg('');
    try {
      await api.supplier.confirmFilled(id);
      setMsg('Group moved to ordering.');
      qc.invalidateQueries('wholesaler-groups');
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) return <Spinner />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div>
      <h1 className="page-title mb-5">Buying groups</h1>
      {msg && <p className="text-sm mb-3">{msg}</p>}
      {!data?.length && <EmptyState title="No groups yet" body="Upload a catalogue CSV to open groups." />}
      <div className="space-y-3">
        {(data || []).map((g) => (
          <div key={g.id} className="card">
            <div className="flex justify-between gap-3">
              <div>
                <div className="font-bold">{g.product_name}</div>
                <div className="text-sm text-muted">
                  {money(g.unit_price)} · {g.current_quantity}/{g.target_quantity} {g.unit} · {g.order_count} orders
                </div>
                <div className="text-xs text-muted mt-1">{formatDeadline(g.deadline) || ''} · {g.pickup_location || ''}</div>
              </div>
              <StatusBadge>{g.status}</StatusBadge>
            </div>
            {(g.status === 'filled' || g.status === 'open') && (
              <button type="button" disabled={busy === g.id} onClick={() => confirm(g.id)} className="btn-secondary mt-3 text-sm">
                {busy === g.id ? 'Updating…' : 'Confirm filled / start ordering'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
