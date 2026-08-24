import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';

export default function SupplierLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await api.supplier.login(email, password);
      localStorage.setItem('kopano_token', res.token);
      if (res.refreshToken) localStorage.setItem('kopano_refresh', res.refreshToken);
      useAuthStore.setState({ user: res.user, token: res.token, isAuthenticated: true, isLoading: false });
      navigate('/supplier');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-screen p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Supplier login</h2>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full border rounded-xl px-3 py-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full border rounded-xl px-3 py-2" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="w-full bg-gray-900 text-white py-3 rounded-xl">Sign in</button>
      </form>
    </div>
  );
}
