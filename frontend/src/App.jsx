import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import GroupDetail from './pages/GroupDetail';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import Profile from './pages/Profile';
import Referrals from './pages/Referrals';
import Success from './pages/Success';
import Admin from './pages/Admin';
import SupplierLogin from './supplier/pages/SupplierLogin';
import SupplierDashboard from './supplier/pages/SupplierDashboard';
import SupplierOrders from './supplier/pages/SupplierOrders';
import SupplierAnalytics from './supplier/pages/SupplierAnalytics';
import SupplierDelivery from './supplier/pages/SupplierDelivery';
import { useAuthStore } from './stores/authStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

export default function App() {
  const init = useAuthStore((s) => s.init);
  useEffect(() => {
    init();
  }, [init]);

  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/supplier/login" element={<SupplierLogin />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/groups/:id" element={<GroupDetail />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/referrals" element={<Referrals />} />
          <Route path="/success" element={<Success />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/supplier" element={<SupplierDashboard />} />
          <Route path="/supplier/orders" element={<SupplierOrders />} />
          <Route path="/supplier/analytics" element={<SupplierAnalytics />} />
          <Route path="/supplier/delivery" element={<SupplierDelivery />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </QueryClientProvider>
  );
}
