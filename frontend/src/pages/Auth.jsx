import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Auth() {
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
  });
  
  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      if (isLogin) {
        await login(form.phone, form.pin);
      } else {
        await register({
          phone: form.phone,
          pin: form.pin,
          businessName: form.businessName,
          category: form.category,
          location: form.location,
        });
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <div className="min-h-screen bg-white px-6 py-8">
      <button onClick={() => navigate('/')} className="flex items-center gap-2 text-gray-500 text-sm mb-8">
        ← Back
      </button>
      
      <h2 className="text-2xl font-semibold mb-6">
        {isLogin ? 'Welcome back' : 'Create account'}
      </h2>
      
      <div className="flex gap-2 mb-6">
        <button 
          onClick={() => setIsLogin(true)}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            isLogin ? 'bg-gray-100 text-gray-900' : 'text-gray-500'
          }`}
        >
          Log in
        </button>
        <button 
          onClick={() => setIsLogin(false)}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            !isLogin ? 'bg-gray-100 text-gray-900' : 'text-gray-500'
          }`}
        >
          Register
        </button>
      </div>
      
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <input
            className="input-field"
            placeholder="Business name"
            value={form.businessName}
            onChange={e => setForm({ ...form, businessName: e.target.value })}
            required
          />
        )}
        
        <input
          className="input-field"
          type="tel"
          placeholder="Mobile number (+267...)"
          value={form.phone}
          onChange={e => setForm({ ...form, phone: e.target.value })}
          required
        />
        
        {!isLogin && (
          <select 
            className="input-field"
            value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })}
          >
            <option value="retail">Retail / Tuckshop</option>
            <option value="beauty">Hair & Beauty</option>
            <option value="food">Food & Catering</option>
            <option value="construction">Construction</option>
            <option value="other">Other</option>
          </select>
        )}
        
        <input
          className="input-field"
          type="password"
          placeholder={isLogin ? 'PIN' : 'Create PIN (4 digits)'}
          maxLength={4}
          value={form.pin}
          onChange={e => setForm({ ...form, pin: e.target.value })}
          required
        />
        
        <button type="submit" className="btn-primary mt-6" disabled={loading}>
          {loading ? 'Please wait...' : isLogin ? 'Log in' : 'Create account'}
        </button>
      </form>
    </div>
  );
}
