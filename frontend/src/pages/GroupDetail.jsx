import { useParams, useNavigate } from 'react-router-dom';
import { useGroup } from '../hooks/useGroups';
import { useState } from 'react';
import { formatDeadline, money } from '../lib/format';
import { useNow } from '../hooks/useOnlineStatus';
import { ErrorState, Spinner } from '../components/ui';

export default function GroupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const now = useNow(30000);
  const { data: group, isLoading, error, refetch } = useGroup(id);
  const [quantity, setQuantity] = useState(1);

  if (isLoading) return <Spinner label="Loading group" />;
  if (error) return <ErrorState message="Could not load this group." onRetry={refetch} />;
  if (!group) return <ErrorState message="Group not found." />;

  const pct = Math.round(Number(group.fill_percentage || 0));
  const remaining = Number(
    group.remaining_quantity ?? Math.max(0, group.target_quantity - group.current_quantity)
  );
  const savings = Number(group.retail_price) - Number(group.unit_price);
  const maxQty = Math.max(1, remaining || 1);
  const deadlineLabel = formatDeadline(group.deadline, now);
  const canJoin = group.is_open !== false && remaining > 0 && group.status === 'open' && deadlineLabel !== 'Closed';

  function handleBuy() {
    navigate('/checkout', {
      state: {
        group: {
          id: group.id,
          product_name: group.product_name,
          unit_price: group.unit_price,
          retail_price: group.retail_price,
          unit: group.unit,
          pickup_location: group.pickup_location,
          remaining_quantity: remaining,
          supplier_name: group.supplier_name,
        },
        quantity,
      },
    });
  }

  return (
    <div className="pb-36 lg:pb-8">
      <button type="button" onClick={() => navigate('/buy')} className="text-sm text-muted font-medium mb-4">
        ← All groups
      </button>
      <p className="label">{group.supplier_name || 'Wholesaler'}</p>
      <h1 className="page-title mt-1">{group.product_name}</h1>
      <p className="text-sm text-muted capitalize mt-1">
        {group.category} · {group.unit}
      </p>

      <div className="card mt-5">
        <div className="flex justify-between items-end mb-3">
          <div>
            <div className="label">Wholesale</div>
            <div className="text-3xl font-extrabold">{money(group.unit_price)}</div>
          </div>
          <div className="text-right">
            <div className="label">Retail</div>
            <div className="text-muted line-through">{money(group.retail_price)}</div>
          </div>
        </div>
        <div className="h-2 bg-clay rounded-full overflow-hidden mb-2">
          <div className={`h-full ${pct >= 100 ? 'bg-success' : 'bg-forest'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <div className="flex justify-between text-sm text-muted">
          <span>
            {group.current_quantity} / {group.target_quantity} {group.unit}
          </span>
          <span>
            {remaining} remaining · {pct}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="card">
          <div className="label">Save per unit</div>
          <div className="text-lg font-extrabold text-success mt-1">{money(savings)}</div>
        </div>
        <div className="card">
          <div className="label">Shops in group</div>
          <div className="text-lg font-extrabold mt-1">{group.member_count || 0}</div>
        </div>
      </div>

      <div className="card mt-3">
        <div className="font-semibold mb-1">Pickup</div>
        <p className="text-sm text-muted">{group.pickup_location || 'Hub to be confirmed'}</p>
        <p className="text-sm text-muted mt-1">{deadlineLabel || 'Open'}</p>
      </div>

      {group.description && (
        <div className="card mt-3">
          <div className="font-semibold mb-1">About this deal</div>
          <p className="text-sm text-muted leading-relaxed">{group.description}</p>
        </div>
      )}

      <div className="fixed bottom-0 inset-x-0 lg:static lg:mt-6 bg-paper border-t border-line lg:border lg:rounded-xl p-4">
        <div className="max-w-app mx-auto flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-11 h-11 bg-clay rounded-lg font-bold"
            >
              −
            </button>
            <span className="text-xl font-extrabold w-8 text-center">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity(Math.min(maxQty, quantity + 1))}
              className="w-11 h-11 bg-clay rounded-lg font-bold"
            >
              +
            </button>
          </div>
          <div className="flex-1 text-right">
            <div className="text-xs text-muted">Merchandise</div>
            <div className="text-lg font-extrabold">{money(quantity * Number(group.unit_price))}</div>
          </div>
        </div>
        <button type="button" onClick={handleBuy} disabled={!canJoin} className="btn-primary mt-3">
          {canJoin ? 'Join this group' : 'Group not open'}
        </button>
      </div>
    </div>
  );
}
