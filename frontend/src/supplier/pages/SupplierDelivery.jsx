import { useState } from 'react';
import { api } from '../../api/client';

export default function SupplierDelivery() {
  const [groupId, setGroupId] = useState('');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState('');

  async function submit(e) {
    e.preventDefault();
    setMsg('');
    try {
      await api.supplier.deliver({ groupId, notes });
      setMsg('Delivery recorded');
    } catch (err) {
      setMsg(err.message);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Record delivery</h2>
      <form onSubmit={submit} className="space-y-3">
        <input className="input-field" placeholder="Group ID" value={groupId} onChange={(e) => setGroupId(e.target.value)} />
        <textarea className="input-field" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button className="btn-primary">Save</button>
      </form>
      {msg && <p className="text-sm mt-3">{msg}</p>}
    </div>
  );
}
