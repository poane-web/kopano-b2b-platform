const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('kopano_token');
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  request,
  auth: {
    login: (phone, pin) => request('/auth/login', { 
      method: 'POST', 
      body: JSON.stringify({ phone, pin }) 
    }),
    register: (data) => request('/auth/register', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),
    me: () => request('/auth/me'),
  },
  
  groups: {
    list: (params = '') => request(`/groups?${params}`),
    get: (id) => request(`/groups/${id}`),
  },
  
  orders: {
    create: (data) => request('/orders', { method: 'POST', body: JSON.stringify(data) }),
    my: () => request('/orders/my'),
    get: (id) => request(`/orders/${id}`),
  },
  
  payments: {
    orangeMoney: (orderId, phone) => request('/payments/orange-money', { 
      method: 'POST', 
      body: JSON.stringify({ orderId, phone }) 
    }),
  },
  
  referrals: {
    myCode: () => request('/referrals/my-code'),
    validate: (code) => request(`/referrals/validate/${code}`),
    apply: (data) => request('/referrals/apply', { method: 'POST', body: JSON.stringify(data) }),
    myStats: () => request('/referrals/my-stats'),
  },
  
  admin: {
    stats: () => request('/admin/stats'),
    users: () => request('/admin/users'),
    groups: () => request('/admin/groups'),
    revenue: () => request('/admin/revenue'),
  },
  
  supplier: {
    login: (email, password) => request('/auth/supplier-login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),
    dashboard: () => request('/supplier-app/dashboard'),
    orders: (params = '') => request(`/supplier-app/orders?${params}`),
    deliver: (formData) => request('/supplier-app/deliveries', { 
      method: 'POST', 
      body: formData 
    }),
    analytics: (period) => request(`/supplier-app/analytics?period=${period || '30days'}`),
    confirmFilled: (groupId) => request(`/supplier-app/groups/${groupId}/confirm-filled`, {
      method: 'POST'
    }),
  },
  
  agent: {
    myStats: () => request('/agents/my-stats'),
    registerShop: (data) => request('/agents/activation', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),
    assistOrder: (orderId) => request('/agents/order-assist', {
      method: 'POST',
      body: JSON.stringify({ orderId })
    }),
  }
};
