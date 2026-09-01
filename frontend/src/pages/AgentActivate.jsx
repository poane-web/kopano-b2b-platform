import { useState } from 'react';
import { api } from '../api/client';
import { useQueryClient } from 'react-query';

export default function AgentActivate() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    businessName: '',
    phone: '+267',
    pin: '',
    category: 'retail',
    location: '',
  });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const res = await api.agent.registerShop(form);
      setMsg(`Activated ${res.shop.business_name}`);
      setForm({ businessName: '', phone: '+267', pin: '', category: 'retail', location: '' });
      qc.invalidateQueries('agent-shops');
      qc.invalidateQueries('agent-stats');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="page-title mb-1">Activate a shop</h1>
      <p className="text-sm text-muted mb-5">Creates a client account tied to you as the activating agent.</p>
      {error && <div className="bg-danger-soft text-danger p-3 rounded-lg text-sm mb-3">{error}</div>}
      {msg && <div className="bg-success-soft text-success p-3 rounded-lg text-sm mb-3">{msg}</div>}
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="input-field" placeholder="Business name" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} required />
        <input className="input-field" placeholder="Phone +267…" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
        <input className="input-field" placeholder="Temporary PIN" maxLength={6} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} required />
        <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          <option value="retail">Retail / tuckshop</option>
          <option value="beauty">Hair & beauty</option>
          <option value="food">Food & catering</option>
          <option value="construction">Construction</option>
          <option value="other">Other</option>
        </select>
        <input className="input-field" placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Activate shop'}</button>
      </form>
    </div>
  );
}
