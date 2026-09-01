import { Link } from 'react-router-dom';
import GroupCard from '../components/GroupCard';
import { useGroups } from '../hooks/useGroups';
import { useAuth } from '../hooks/useAuth';
import { useQuery } from 'react-query';
import { api } from '../api/client';
import { money, ORDER_LABELS, ORDER_TONE } from '../lib/format';
import { EmptyState, ErrorState, Spinner, StatusBadge, Stat } from '../components/ui';

export default function Dashboard() {
  const { user } = useAuth();
  const { data: groups, isLoading, error, refetch } = useGroups();
  const ordersQ = useQuery('my-orders', () => api.orders.my(), { staleTime: 15_000 });
  const rewardsQ = useQuery('my-rewards', () => api.referrals.myStats(), { staleTime: 30_000 });

  const openGroups = groups || [];
  const recent = (ordersQ.data || []).slice(0, 3);

  return (
    <div>
      <div className="mb-6">
        <p className="label">Client workspace</p>
        <h1 className="page-title mt-1">{user?.business_name || 'Your shop'}</h1>
        <p className="text-sm text-muted mt-1">
          Join a buying group, pay in Pula, pick up at a hub.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <Stat label="Saved so far" value={money(user?.total_savings)} hint="Confirmed paid orders" />
        <Stat label="Open groups" value={isLoading ? '—' : openGroups.length} hint="Available to join" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-8">
        {[
          { to: '/buy', label: 'Find products' },
          { to: '/orders', label: 'My orders' },
          { to: '/rewards', label: 'Rewards' },
          { to: '/profile', label: 'Profile' },
        ].map((a) => (
          <Link key={a.to} to={a.to} className="btn-secondary text-sm">
            {a.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold">Active buying groups</h2>
        <Link to="/buy" className="text-sm font-semibold text-forest">
          View all
        </Link>
      </div>
      {isLoading && <Spinner label="Loading groups" />}
      {error && <ErrorState message="Could not load groups." onRetry={refetch} />}
      {!isLoading && !error && openGroups.length === 0 && (
        <EmptyState title="No active buying groups right now" body="Check back soon — wholesalers open new groups as stock becomes available." />
      )}
      <div className="space-y-3 mb-8">
        {openGroups.slice(0, 4).map((g) => (
          <GroupCard key={g.id} group={g} />
        ))}
      </div>

      <h2 className="font-bold mb-3">Recent orders</h2>
      {ordersQ.isLoading && <p className="text-sm text-muted">Loading orders…</p>}
      {!ordersQ.isLoading && recent.length === 0 && (
        <EmptyState title="No orders yet" body="Browse groups to place your first order." action={<Link to="/buy" className="btn-primary max-w-xs mx-auto">Browse groups</Link>} />
      )}
      <div className="space-y-2 mb-8">
        {recent.map((o) => (
          <div key={o.id} className="card flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-sm">{o.product_name}</div>
              <div className="text-xs text-muted">{o.order_number} · qty {o.quantity}</div>
            </div>
            <StatusBadge tone={ORDER_TONE[o.status] || 'neutral'}>{ORDER_LABELS[o.status] || o.status}</StatusBadge>
          </div>
        ))}
      </div>

      <div className="card bg-ink text-paper">
        <div className="text-xs uppercase tracking-wider text-paper/60 font-semibold">Rewards</div>
        <div className="text-2xl font-extrabold mt-1">{rewardsQ.data?.code?.code || '—'}</div>
        <p className="text-sm text-paper/70 mt-1">Share your code. You earn when referred shops order.</p>
        <Link to="/rewards" className="inline-block mt-3 text-sm font-semibold text-leaf">
          Open rewards →
        </Link>
      </div>
    </div>
  );
}
