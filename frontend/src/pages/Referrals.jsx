import { useQuery } from 'react-query';
import { api } from '../api/client';
import { useState } from 'react';
import { EmptyState, ErrorState, Spinner, Stat, StatusBadge } from '../components/ui';
import { moneyInt } from '../lib/format';

export default function Referrals() {
  const { data: stats, isLoading, error, refetch } = useQuery('my-rewards', () => api.referrals.myStats());
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    if (!stats?.code?.code) return;
    await navigator.clipboard.writeText(stats.code.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareOnWhatsApp() {
    const text = `Join Kopano and save on business stock. Use my code ${stats?.code?.code} when you sign up.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  if (isLoading) return <Spinner label="Loading rewards" />;
  if (error) return <ErrorState message="Could not load rewards." onRetry={refetch} />;

  return (
    <div>
      <h1 className="page-title mb-1">Rewards</h1>
      <p className="text-sm text-muted mb-5">Earn when shops you refer place orders. Amounts come from the ledger — nothing is estimated here.</p>

      <div className="card bg-ink text-paper mb-4">
        <div className="text-xs uppercase tracking-wider text-paper/60">Your referral code</div>
        <div className="text-3xl font-extrabold tracking-wider mt-1">{stats?.code?.code || '—'}</div>
        <div className="flex gap-2 mt-4">
          <button type="button" onClick={copyCode} className="flex-1 bg-paper text-ink py-2.5 rounded-lg text-sm font-semibold">
            {copied ? 'Copied' : 'Copy code'}
          </button>
          <button type="button" onClick={shareOnWhatsApp} className="flex-1 bg-leaf text-paper py-2.5 rounded-lg text-sm font-semibold">
            WhatsApp
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat label="Earned" value={moneyInt(stats?.earnings?.total)} />
        <Stat label="Pending" value={moneyInt(stats?.earnings?.pending)} />
        <Stat label="Paid" value={moneyInt(stats?.earnings?.paid)} />
      </div>

      <div className="card mb-4">
        <div className="font-semibold mb-3">How you earn</div>
        <ul className="text-sm text-muted space-y-2">
          <li>Activation bonus when a referred shop places a first paid order.</li>
          <li>Share of platform fees on their later orders.</li>
          <li>Share of Pro subscription if they upgrade — when that product is live.</li>
        </ul>
      </div>

      <div className="card">
        <div className="font-semibold mb-3">Referred shops ({stats?.referrals?.length || 0})</div>
        {!stats?.referrals?.length ? (
          <EmptyState title="No referrals yet" body="Share your code with other shops." />
        ) : (
          <div className="space-y-2">
            {stats.referrals.map((r) => (
              <div key={r.id} className="flex justify-between items-center py-2 border-b border-line last:border-0">
                <div>
                  <div className="text-sm font-semibold">{r.business_name}</div>
                  <div className="text-xs text-muted">
                    {r.total_orders} orders · {moneyInt(r.total_gmv)} GMV
                  </div>
                </div>
                <StatusBadge tone={r.status === 'active' ? 'ok' : 'neutral'}>{r.status}</StatusBadge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
