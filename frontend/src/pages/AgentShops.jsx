import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { EmptyState, ErrorState, Spinner } from '../components/ui';
import { formatDate } from '../lib/format';

export default function AgentShops() {
  const { data, isLoading, error, refetch } = useQuery('agent-shops', () => api.agent.shops());
  if (isLoading) return <Spinner label="Loading shops" />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div>
      <h1 className="page-title mb-5">Registered shops</h1>
      {!data?.length && (
        <EmptyState
          title="No shops activated yet"
          body="Register a client with their phone and PIN."
          action={<Link to="/agent/activate" className="btn-primary max-w-xs mx-auto">Activate shop</Link>}
        />
      )}
      <div className="space-y-2">
        {(data || []).map((s) => (
          <div key={s.id} className="card">
            <div className="font-bold">{s.business_name}</div>
            <div className="text-sm text-muted">{s.phone} · {s.category} · {s.location || '—'}</div>
            <div className="text-xs text-muted mt-1">Activated {formatDate(s.activated_at)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
