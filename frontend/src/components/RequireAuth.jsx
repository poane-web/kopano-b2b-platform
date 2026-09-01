import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { homePath } from '../lib/format';
import { Spinner } from './ui';

export function RequireAuth({ children, roles }) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-sand">
        <Spinner label="Signing you in" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  if (roles && roles.length && !roles.includes(user?.role)) {
    return <Navigate to={homePath(user?.role)} replace />;
  }

  return children;
}

export function GuestOnly({ children }) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  if (isLoading) {
    return (
      <div className="min-h-screen bg-sand">
        <Spinner />
      </div>
    );
  }
  if (isAuthenticated) return <Navigate to={homePath(user?.role)} replace />;
  return children;
}
