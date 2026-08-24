import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';
import BottomNav from '../components/BottomNav';

export default function Profile() {
  const { user, logout } = useAuth();
  
  if (!user) return <div className="p-4">Loading...</div>;
  
  return (
    <div className="pb-24">
      <h2 className="text-xl font-semibold mb-4">Profile</h2>
      
      <div className="card flex items-center gap-4 mb-4">
        <div className="w-12 h-12 bg-gray-900 text-white rounded-full flex items-center justify-center text-lg font-medium">
          {user.business_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="font-medium">{user.business_name}</div>
          <div className="text-sm text-gray-500 capitalize">{user.category} · {user.location || 'Botswana'}</div>
        </div>
      </div>
      
      <div className="space-y-2 mb-6">
        <div className="card flex justify-between items-center py-3">
          <span className="text-sm">Subscription</span>
          <span className="text-xs px-2.5 py-1 bg-green-50 text-green-700 rounded-md font-medium capitalize">
            {user.subscription_tier}
          </span>
        </div>
        <div className="card flex justify-between items-center py-3">
          <span className="text-sm">Total savings</span>
          <span className="font-medium">P{user.total_savings?.toLocaleString() || '0'}</span>
        </div>
        <div className="card flex justify-between items-center py-3">
          <span className="text-sm">KYC status</span>
          <span className={`text-xs px-2.5 py-1 rounded-md font-medium ${
            user.kyc_status === 'verified' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
          }`}>
            {user.kyc_status}
          </span>
        </div>
      </div>
      
      <div className="space-y-2">
        <Link to="/admin" className="btn-secondary block text-center">Switch to admin view</Link>
        <button onClick={logout} className="btn-secondary text-red-600 border-red-200 hover:bg-red-50">
          Log out
        </button>
      </div>
      
      <BottomNav active="/profile" />
    </div>
  );
}
