import { useState } from 'react';
import GroupCard from '../components/GroupCard';
import { useGroups } from '../hooks/useGroups';
import { EmptyState, ErrorState, Spinner } from '../components/ui';

const CATS = [
  { id: '', label: 'All' },
  { id: 'food', label: 'Food' },
  { id: 'beauty', label: 'Beauty' },
  { id: 'construction', label: 'Build' },
  { id: 'retail', label: 'Retail' },
  { id: 'other', label: 'Other' },
];

export default function Buy() {
  const [cat, setCat] = useState('');
  const { data: groups, isLoading, error, refetch } = useGroups(cat || undefined);

  return (
    <div>
      <h1 className="page-title mb-1">Buy</h1>
      <p className="text-sm text-muted mb-5">Open buying groups from Botswana wholesalers. Prices in BWP.</p>
      <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1 mb-4">
        {CATS.map((c) => (
          <button
            key={c.id || 'all'}
            type="button"
            onClick={() => setCat(c.id)}
            className={`px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap min-h-[40px] ${
              cat === c.id ? 'bg-forest text-paper' : 'bg-paper border border-line text-ink'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      {isLoading && <Spinner label="Loading groups" />}
      {error && <ErrorState message="Could not load groups." onRetry={refetch} />}
      {!isLoading && !error && (!groups || groups.length === 0) && (
        <EmptyState title="No active buying groups right now" body="Nothing is open in this category." />
      )}
      <div className="space-y-3">
        {(groups || []).map((g) => (
          <GroupCard key={g.id} group={g} />
        ))}
      </div>
    </div>
  );
}
