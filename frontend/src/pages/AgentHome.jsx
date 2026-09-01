import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { ErrorState, Spinner, Stat } from '../components/ui';
import { moneyInt } from '../lib/format';
import { useAuth } from '../hooks/useAuth';

export default function AgentHome() {
  const { user } = useAuth();
  const stats = useQuery('agent-stats', () => api.agent.myStats());
  const shops = useQuery('agent-shops', () => api.agent.shops());
  const rewards = useQuery('my-rewards', () => api.referrals.myStats());

  if (stats.isLoading) return <Spinner label="Loading agent workspace" />;
  if (stats.error) return <ErrorState message={stats.error.message} onRetry={stats.refetch} />;

  return (
    <div>
      <p className="label">Agent</p>
      <h1 className="page-title mt-1">{user?.business_name || 'Field workspace'}</h1>
      <p className="text-sm text-muted mt-1 mb-6">
        Activate shops in {stats.data?.region || 'your region'} and help them place orders.
      </p>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Stat label="Shops activated" value={stats.data?.totalActivations ?? 0} />
        <Stat label="Listed shops" value={shops.data?.length ?? '—'} />
        <Stat label="Referral earnings" value={moneyInt(rewards.data?.earnings?.total)} hint="From the ledger" />
        <Stat label="Pending" value={moneyInt(rewards.data?.earnings?.pending)} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        <Link to="/agent/activate" className="btn-primary">
          Activate a shop
        </Link>
        <Link to="/agent/assist" className="btn-secondary">
          Assist an order
        </Link>
      </div>
      <div className="card">
        <div className="font-semibold">Commissions</div>
        <p className="text-sm text-muted mt-1">
          Agent-specific field commissions are not a separate product yet. Referral earnings above come from the
          existing rewards ledger for this account.
        </p>
        <Link to="/rewards" className="inline-block mt-3 text-sm font-semibold text-forest">
          Open rewards →
        </Link>
      </div>
    </div>
  );
}
