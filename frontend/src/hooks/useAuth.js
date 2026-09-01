import { useAuthStore } from '../stores/authStore';

export function useAuth() {
  const { user, isAuthenticated, isLoading, login, register, logout, loginSupplier } = useAuthStore();
  return { user, isAuthenticated, isLoading, login, register, logout, loginSupplier };
}
