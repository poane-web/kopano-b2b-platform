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
          {user.business_name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="font-medium">{user.business_name}</div>
          <div className="text-sm text-gray-500 capitalize">
            {user.category} · {user.location || 'Botswana'}
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-6">
        <div className="card flex justify-between items-center py-3">
          <span className="text-sm">Role</span>
          <span className="text-xs px-2.5 py-1 bg-gray-100 rounded-md font-medium capitalize">{user.role || 'customer'}</span>
        </div>
        <div className="card flex justify-between items-center py-3">
          <span className="text-sm">Total savings</span>
          <span className="font-medium">P{Number(user.total_savings || 0).toLocaleString()}</span>
        </div>
      </div>

      <div className="space-y-2">
        {user.role === 'admin' && (
          <Link to="/admin" className="btn-secondary block text-center">
            Admin view
          </Link>
        )}
        {user.role === 'supplier' && (
          <Link to="/supplier" className="btn-secondary block text-center">
            Supplier portal
          </Link>
        )}
        <button onClick={logout} className="btn-secondary text-red-600 border-red-200">
          Log out
        </button>
      </div>

      <BottomNav active="/profile" />
    </div>
  );
}
