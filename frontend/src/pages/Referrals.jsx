import { useEffect, useState } from 'react';
import { api } from '../api/client';
import BottomNav from '../components/BottomNav';

export default function Referrals() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.referrals.myStats().then(setStats).finally(() => setLoading(false));
  }, []);

  async function copyCode() {
    if (!stats?.code?.code) return;
    await navigator.clipboard.writeText(stats.code.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareOnWhatsApp() {
    const text = `Join Kopano and save 20-40% on your business stock! Use my code *${stats?.code?.code}* when you sign up. Sign up here: https://kopano.co.bw/auth?ref=${stats?.code?.code}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  if (loading) return <div className="p-4 pb-24"><BottomNav active="/referrals" /></div>;

  return (
    <div className="pb-24">
      <h2 className="text-xl font-semibold mb-4">My Referrals</h2>

      <div className="card bg-gray-900 text-white mb-4">
        <div className="text-sm text-gray-400 mb-1">Your referral code</div>
        <div className="text-3xl font-bold tracking-wider mb-3">{stats?.code?.code || '---'}</div>
        <div className="flex gap-2">
          <button onClick={copyCode} className="flex-1 bg-white text-gray-900 py-2 rounded-lg text-sm font-medium">
            {copied ? 'Copied!' : 'Copy code'}
          </button>
          <button onClick={shareOnWhatsApp} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium">
            Share on WhatsApp
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="card text-center py-3">
          <div className="text-xs text-gray-500 mb-1">Total earned</div>
          <div className="text-lg font-semibold">P{Math.floor(stats?.earnings?.total || 0)}</div>
        </div>
        <div className="card text-center py-3">
          <div className="text-xs text-gray-500 mb-1">Pending</div>
          <div className="text-lg font-semibold text-amber-600">P{Math.floor(stats?.earnings?.pending || 0)}</div>
        </div>
        <div className="card text-center py-3">
          <div className="text-xs text-gray-500 mb-1">Paid out</div>
          <div className="text-lg font-semibold text-green-600">P{Math.floor(stats?.earnings?.paid || 0)}</div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="text-sm font-medium mb-3">How you earn</div>
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center text-sm flex-shrink-0">1</div>
            <div>
              <div className="text-sm font-medium">P30 activation bonus</div>
              <div className="text-xs text-gray-500">When your referred shop places their first order</div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center text-sm flex-shrink-0">2</div>
            <div>
              <div className="text-sm font-medium">15% of every platform fee</div>
              <div className="text-xs text-gray-500">Earn on every order they place — forever</div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center text-sm flex-shrink-0">3</div>
            <div>
              <div className="text-sm font-medium">20% of their subscription</div>
              <div className="text-xs text-gray-500">For 6 months if they upgrade to Pro</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="text-sm font-medium mb-3">
          Referred shops ({stats?.referrals?.length || 0})
        </div>
        {stats?.referrals?.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-4">
            No referrals yet. Share your code!
          </div>
        ) : (
          <div className="space-y-2">
            {stats.referrals.map(r => (
              <div key={r.id} className="flex justify-between items-center py-2 border-b last:border-0">
                <div>
                  <div className="text-sm font-medium">{r.business_name}</div>
                  <div className="text-xs text-gray-500">{r.total_orders} orders · P{Math.floor(r.total_gmv)} GMV</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-md ${
                  r.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav active="/referrals" />
    </div>
  );
}
