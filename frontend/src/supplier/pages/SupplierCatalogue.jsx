import { useState } from 'react';
import { api } from '../../api/client';
import { useQueryClient } from 'react-query';
import { money } from '../../lib/format';

export default function SupplierCatalogue() {
  const qc = useQueryClient();
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function upload(persist) {
    if (!file) {
      setError('Choose a CSV file first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.supplier.bulkUpload(fd, persist);
      setPreview(res);
      if (persist) qc.invalidateQueries('wholesaler-groups');
    } catch (e) {
      setError(e.message);
      setPreview(e.errors ? e : null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="page-title mb-1">Catalogue</h1>
      <p className="text-sm text-muted mb-5">
        CSV columns: title, rrp, groupPrice, targetUnits, category, unit, description. Preview first — nothing is saved until you persist.
      </p>
      {error && <div className="bg-danger-soft text-danger p-3 rounded-lg text-sm mb-3">{error}</div>}
      <div className="card mb-4">
        <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <div className="flex gap-2 mt-4">
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => upload(false)}>
            {busy ? 'Reading…' : 'Preview'}
          </button>
          <button type="button" className="btn-primary" disabled={busy || !preview?.items?.length} onClick={() => upload(true)}>
            Persist valid rows
          </button>
        </div>
      </div>
      {preview && (
        <div className="card">
          <div className="font-semibold mb-2">{preview.message || (preview.persisted ? 'Saved' : 'Preview')}</div>
          <p className="text-sm text-muted mb-3">
            {preview.items?.length || 0} valid · {preview.errors?.length || 0} rejected
          </p>
          <div className="space-y-1 text-sm">
            {(preview.items || []).slice(0, 20).map((item, i) => (
              <div key={i} className="flex justify-between border-b border-line py-1">
                <span>{item.title || item.product_name}</span>
                <span>{item.groupPrice != null ? money(item.groupPrice) : ''}</span>
              </div>
            ))}
          </div>
          {!!preview.errors?.length && (
            <div className="mt-3 text-xs text-danger">
              {preview.errors.slice(0, 8).map((err, i) => (
                <div key={i}>Line {err.line}: {(err.errors || []).join(', ')}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
