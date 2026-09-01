import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';
import { homePath, initials, money } from '../lib/format';

export default function Profile() {
  const { user, logout } = useAuth();
  if (!user) return <p className="text-muted">Loading profile…</p>;

  const name = user.business_name || user.name || 'Account';
  const role = user.role || 'customer';

  return (
    <div className="max-w-lg">
      <h1 className="page-title mb-5">Profile</h1>
      <div className="card flex items-center gap-4 mb-4">
        <div className="w-14 h-14 bg-forest text-paper rounded-full grid place-items-center text-lg font-bold">
          {initials(name)}
        </div>
        <div>
          <div className="font-bold text-lg">{name}</div>
          <div className="text-sm text-muted capitalize">
            {role === 'supplier' ? 'Wholesaler' : role} · {user.location || 'Botswana'}
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-6">
        {user.phone && (
          <div className="card flex justify-between py-3">
            <span className="text-sm text-muted">Phone</span>
            <span className="font-medium">{user.phone}</span>
          </div>
        )}
        {user.email && (
          <div className="card flex justify-between py-3">
            <span className="text-sm text-muted">Email</span>
            <span className="font-medium">{user.email}</span>
          </div>
        )}
        {user.category && (
          <div className="card flex justify-between py-3">
            <span className="text-sm text-muted">Category</span>
            <span className="font-medium capitalize">{user.category}</span>
          </div>
        )}
        <div className="card flex justify-between py-3">
          <span className="text-sm text-muted">Workspace</span>
          <Link to={homePath(role)} className="text-sm font-semibold text-forest">
            Open {role === 'supplier' ? 'wholesaler' : role} home
          </Link>
        </div>
        {user.total_savings != null && (
          <div className="card flex justify-between py-3">
            <span className="text-sm text-muted">Confirmed savings</span>
            <span className="font-bold">{money(user.total_savings)}</span>
          </div>
        )}
      </div>

      <button type="button" onClick={logout} className="btn-secondary text-danger border-danger/30">
        Log out
      </button>
    </div>
  );
}
