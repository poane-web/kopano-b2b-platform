import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { homePath } from '../lib/format';

export default function Auth() {
  const [params] = useSearchParams();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const [form, setForm] = useState({
    phone: '+267',
    pin: '',
    businessName: '',
    category: 'retail',
    location: '',
    referralCode: params.get('ref') || '',
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      let res;
      if (isLogin) {
        res = await login(form.phone, form.pin);
      } else {
        res = await register({
          phone: form.phone,
          pin: form.pin,
          businessName: form.businessName,
          category: form.category,
          location: form.location,
          referralCode: form.referralCode || undefined,
        });
      }
      navigate(homePath(res.user?.role), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-sand px-5 py-8 max-w-md mx-auto">
      <Link to="/" className="text-sm text-muted font-medium">
        ← Kopano
      </Link>
      <h2 className="page-title mt-8 mb-2">{isLogin ? 'Welcome back' : 'Register your shop'}</h2>
      <p className="text-sm text-muted mb-6">
        {isLogin
          ? 'Clients, agents and admins log in with a Botswana mobile number and PIN.'
          : 'Create a client account to join buying groups.'}
      </p>

      <div className="flex gap-1 p-1 bg-clay rounded-lg mb-6">
        <button
          type="button"
          onClick={() => setIsLogin(true)}
          className={`flex-1 py-2 rounded-md text-sm font-semibold ${isLogin ? 'bg-paper shadow-card text-ink' : 'text-muted'}`}
        >
          Log in
        </button>
        <button
          type="button"
          onClick={() => setIsLogin(false)}
          className={`flex-1 py-2 rounded-md text-sm font-semibold ${!isLogin ? 'bg-paper shadow-card text-ink' : 'text-muted'}`}
        >
          Register
        </button>
      </div>

      {error && <div className="bg-danger-soft text-danger px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-3">
        {!isLogin && (
          <input
            className="input-field"
            placeholder="Business name"
            value={form.businessName}
            onChange={(e) => setForm({ ...form, businessName: e.target.value })}
            required
          />
        )}
        <input
          className="input-field"
          type="tel"
          placeholder="Mobile number (+267…)"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          required
        />
        {!isLogin && (
          <>
            <select
              className="input-field"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="retail">Retail / tuckshop</option>
              <option value="beauty">Hair & beauty</option>
              <option value="food">Food & catering</option>
              <option value="construction">Construction</option>
              <option value="other">Other</option>
            </select>
            <input
              className="input-field"
              placeholder="Location (e.g. Francistown)"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
            <input
              className="input-field"
              placeholder="Referral code (optional)"
              value={form.referralCode}
              onChange={(e) => setForm({ ...form, referralCode: e.target.value })}
            />
          </>
        )}
        <input
          className="input-field"
          type="password"
          inputMode="numeric"
          placeholder={isLogin ? 'PIN' : 'Create a 4–6 digit PIN'}
          maxLength={6}
          value={form.pin}
          onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
          required
        />
        <button type="submit" className="btn-primary mt-2" disabled={loading}>
          {loading ? 'Please wait…' : isLogin ? 'Log in' : 'Create account'}
        </button>
      </form>

      <p className="text-center text-sm text-muted mt-8">
        Wholesaler?{' '}
        <Link to="/wholesaler/login" className="text-forest font-semibold">
          Sign in here
        </Link>
      </p>
    </div>
  );
}
