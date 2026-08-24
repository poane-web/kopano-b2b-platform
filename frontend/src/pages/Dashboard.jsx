import { Link } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import GroupCard from '../components/GroupCard';
import { useGroups } from '../hooks/useGroups';

export default function Dashboard() {
  const { data: groups, isLoading, error } = useGroups();

  return (
    <div className="pb-24">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Active buying groups</h1>
          <p className="text-xs text-gray-500">Join groups to unlock wholesale prices (BWP)</p>
        </div>
        <Link to="/referrals" className="text-xs bg-green-100 text-green-800 font-medium px-3 py-1.5 rounded-full">
          Earn
        </Link>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading groups…</p>}
      {error && <p className="text-sm text-red-600">Could not load groups. Check your connection.</p>}
      {!isLoading && !error && (!groups || groups.length === 0) && (
        <p className="text-sm text-gray-500 py-8 text-center">No open groups right now.</p>
      )}

      <div className="space-y-4">
        {(groups || []).map((group) => (
          <GroupCard key={group.id} group={group} />
        ))}
      </div>

      <BottomNav active="/dashboard" />
    </div>
  );
}
