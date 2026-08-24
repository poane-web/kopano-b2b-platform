import { Link } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import GroupCard from '../components/GroupCard';

export default function Dashboard() {
  const sampleGroups = [
    { id: '1', name: 'Cooking Oil (20L Bulk)', description: 'Target: 50 units · Save 25% on wholesale market price.' },
    { id: '2', name: 'Maize Meal 10kg Packs', description: 'Target: 100 units · Direct factory dispatch.' }
  ];

  return (
    <div className="pb-24 p-4 max-w-lg mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Active Buying Groups</h1>
          <p className="text-xs text-gray-500">Join groups to unlock wholesale prices</p>
        </div>
        <Link to="/referrals" className="text-xs bg-green-100 text-green-800 font-medium px-3 py-1.5 rounded-full">
          🎁 Earn P30
        </Link>
      </div>

      <div className="space-y-4">
        {sampleGroups.map(group => (
          <GroupCard key={group.id} group={group} />
        ))}
      </div>

      <BottomNav active="/dashboard" />
    </div>
  );
}
