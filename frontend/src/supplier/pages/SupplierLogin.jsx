import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export default function SupplierLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const loginSupplier = useAuthStore((s) => s.loginSupplier);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await loginSupplier(email, password);
      navigate('/wholesaler', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-sand px-5 py-10 max-w-md mx-auto">
      <Link to="/" className="text-sm text-muted font-medium">← Kopano</Link>
      <h2 className="page-title mt-8 mb-2">Wholesaler sign in</h2>
      <p className="text-sm text-muted mb-6">Use the email issued for your wholesale account.</p>
      {error && <p className="text-sm text-danger bg-danger-soft p-3 rounded-lg mb-3">{error}</p>}
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="input-field" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="input-field" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button className="btn-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="text-sm text-muted mt-6">
        Shop owner? <Link to="/auth" className="text-forest font-semibold">Client login</Link>
      </p>
    </div>
  );
}
