const API_BASE = import.meta.env.VITE_API_URL || '/api';

let refreshPromise = null;

function getAccessToken() {
  return localStorage.getItem('kopano_token');
}

async function tryRefresh() {
  const refreshToken = localStorage.getItem('kopano_refresh');
  if (!refreshToken) return null;
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('refresh failed');
        const data = await res.json();
        localStorage.setItem('kopano_token', data.token);
        return data.token;
      })
      .catch(() => {
        localStorage.removeItem('kopano_token');
        localStorage.removeItem('kopano_refresh');
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function request(endpoint, options = {}, { retry = true } = {}) {
  const token = getAccessToken();
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

  if (res.status === 401 && retry && localStorage.getItem('kopano_refresh')) {
    const next = await tryRefresh();
    if (next) return request(endpoint, options, { retry: false });
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(err.error || `HTTP ${res.status}`);
    e.code = err.code;
    e.status = res.status;
    e.errors = err.errors;
    e.payload = err;
    throw e;
  }
  return res.json();
}

export const api = {
  request,
  auth: {
    login: (phone, pin) => request('/auth/login', { method: 'POST', body: JSON.stringify({ phone, pin }) }),
    register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    me: () => request('/auth/me'),
    refresh: (refreshToken) =>
      request('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  },
  groups: {
    list: (params = '') => request(`/groups?${params}`),
    get: (id) => request(`/groups/${id}`),
  },
  orders: {
    create: (data) => request('/orders', { method: 'POST', body: JSON.stringify(data) }),
    my: () => request('/orders/my'),
    cancel: (id) => request(`/orders/${id}/cancel`, { method: 'POST' }),
  },
  payments: {
    orangeMoney: (orderId, extra = {}) =>
      request('/payments/orange-money', {
        method: 'POST',
        body: JSON.stringify({ orderId }),
        headers: extra.idempotencyKey ? { 'X-Idempotency-Key': extra.idempotencyKey } : {},
      }),
    status: (transactionId) => request(`/payments/status/${transactionId}`),
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
    login: (email, password) =>
      request('/auth/supplier-login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    dashboard: () => request('/supplier-app/dashboard'),
    groups: () => request('/supplier-app/groups'),
    orders: (params = '') => request(`/supplier-app/orders${params ? `?${params}` : ''}`),
    order: (id) => request(`/supplier-app/orders/${id}`),
    deliveries: () => request('/supplier-app/deliveries'),
    deliver: (data) =>
      request('/supplier-app/deliveries', { method: 'POST', body: JSON.stringify(data) }),
    analytics: (period) => request(`/supplier-app/analytics?period=${period || '30days'}`),
    confirmFilled: (groupId) =>
      request(`/supplier-app/groups/${groupId}/confirm-filled`, { method: 'POST' }),
    bulkUpload: (formData, persist = false) =>
      request(`/supplier-app/bulk-upload${persist ? '?persist=true' : ''}`, {
        method: 'POST',
        body: formData,
      }),
  },
  agent: {
    myStats: () => request('/agents/my-stats'),
    shops: () => request('/agents/shops'),
    registerShop: (data) => request('/agents/activation', { method: 'POST', body: JSON.stringify(data) }),
    assistOrder: (orderId) =>
      request('/agents/order-assist', { method: 'POST', body: JSON.stringify({ orderId }) }),
  },
};
