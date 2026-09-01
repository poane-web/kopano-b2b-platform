export function money(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 'P0.00';
  return `P${n.toLocaleString('en-BW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function moneyInt(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 'P0';
  return `P${Math.round(n).toLocaleString('en-BW')}`;
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDeadline(value, now = Date.now()) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const diff = d.getTime() - now;
  if (diff <= 0) return 'Closed';
  const mins = Math.ceil(diff / (1000 * 60));
  if (mins < 60) return `${mins} min left`;
  const hours = Math.ceil(diff / (1000 * 60 * 60));
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} left`;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days === 1) return 'Closes tomorrow';
  return `${days} days left`;
}

export function initials(name) {
  return String(name || 'K')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function homePath(role) {
  if (role === 'supplier') return '/wholesaler';
  if (role === 'agent') return '/agent';
  if (role === 'admin') return '/admin';
  return '/app';
}

export const ORDER_LABELS = {
  pending_payment: 'Awaiting payment',
  payment_initiated: 'Payment started',
  paid: 'Paid',
  group_filling: 'Group filling',
  ordered: 'Ordered from wholesaler',
  ready_pickup: 'Ready for pickup',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  expired: 'Expired',
};

export const ORDER_TONE = {
  pending_payment: 'warn',
  payment_initiated: 'warn',
  paid: 'ok',
  group_filling: 'ok',
  ordered: 'ok',
  ready_pickup: 'ok',
  delivered: 'ok',
  cancelled: 'bad',
  refunded: 'bad',
  expired: 'bad',
};

export function isPaymentConfirmed(status) {
  return status === 'paid' || status === 'completed';
}
