import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import AppShell from './components/AppShell';
import { RequireAuth, GuestOnly } from './components/RequireAuth';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Buy from './pages/Buy';
import GroupDetail from './pages/GroupDetail';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import Profile from './pages/Profile';
import Referrals from './pages/Referrals';
import Success from './pages/Success';
import Admin from './pages/Admin';
import AdminClients from './pages/AdminClients';
import AdminGroups from './pages/AdminGroups';
import AdminRevenue from './pages/AdminRevenue';
import SupplierLogin from './supplier/pages/SupplierLogin';
import SupplierDashboard from './supplier/pages/SupplierDashboard';
import SupplierOrders from './supplier/pages/SupplierOrders';
import SupplierOrderDetail from './supplier/pages/SupplierOrderDetail';
import SupplierAnalytics from './supplier/pages/SupplierAnalytics';
import SupplierDelivery from './supplier/pages/SupplierDelivery';
import SupplierGroups from './supplier/pages/SupplierGroups';
import SupplierCatalogue from './supplier/pages/SupplierCatalogue';
import AgentHome from './pages/AgentHome';
import AgentShops from './pages/AgentShops';
import AgentActivate from './pages/AgentActivate';
import AgentAssist from './pages/AgentAssist';
import { useAuthStore } from './stores/authStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

function Customer({ children }) {
  return <RequireAuth roles={['customer', 'admin']}>{children}</RequireAuth>;
}
function Wholesaler({ children }) {
  return <RequireAuth roles={['supplier']}>{children}</RequireAuth>;
}
function Agent({ children }) {
  return <RequireAuth roles={['agent', 'admin']}>{children}</RequireAuth>;
}
function AdminOnly({ children }) {
  return <RequireAuth roles={['admin']}>{children}</RequireAuth>;
}

export default function App() {
  const init = useAuthStore((s) => s.init);
  useEffect(() => {
    init();
  }, [init]);

  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/auth"
          element={
            <GuestOnly>
              <Auth />
            </GuestOnly>
          }
        />
        <Route
          path="/supplier/login"
          element={
            <GuestOnly>
              <SupplierLogin />
            </GuestOnly>
          }
        />
        <Route
          path="/wholesaler/login"
          element={
            <GuestOnly>
              <SupplierLogin />
            </GuestOnly>
          }
        />

        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/app" element={<Customer><Dashboard /></Customer>} />
          <Route path="/dashboard" element={<Navigate to="/app" replace />} />
          <Route path="/buy" element={<Customer><Buy /></Customer>} />
          <Route path="/groups/:id" element={<Customer><GroupDetail /></Customer>} />
          <Route path="/checkout" element={<Customer><Checkout /></Customer>} />
          <Route path="/orders" element={<Customer><Orders /></Customer>} />
          <Route
            path="/rewards"
            element={
              <RequireAuth roles={['customer', 'agent', 'admin']}>
                <Referrals />
              </RequireAuth>
            }
          />
          <Route path="/referrals" element={<Navigate to="/rewards" replace />} />
          <Route path="/success" element={<Customer><Success /></Customer>} />
          <Route path="/profile" element={<Profile />} />

          <Route path="/wholesaler" element={<Wholesaler><SupplierDashboard /></Wholesaler>} />
          <Route path="/wholesaler/groups" element={<Wholesaler><SupplierGroups /></Wholesaler>} />
          <Route path="/wholesaler/orders" element={<Wholesaler><SupplierOrders /></Wholesaler>} />
          <Route path="/wholesaler/orders/:id" element={<Wholesaler><SupplierOrderDetail /></Wholesaler>} />
          <Route path="/wholesaler/catalogue" element={<Wholesaler><SupplierCatalogue /></Wholesaler>} />
          <Route path="/wholesaler/deliveries" element={<Wholesaler><SupplierDelivery /></Wholesaler>} />
          <Route path="/wholesaler/analytics" element={<Wholesaler><SupplierAnalytics /></Wholesaler>} />
          <Route path="/wholesaler/profile" element={<Wholesaler><Profile /></Wholesaler>} />
          <Route path="/supplier" element={<Navigate to="/wholesaler" replace />} />
          <Route path="/supplier/orders" element={<Navigate to="/wholesaler/orders" replace />} />
          <Route path="/supplier/analytics" element={<Navigate to="/wholesaler/analytics" replace />} />
          <Route path="/supplier/delivery" element={<Navigate to="/wholesaler/deliveries" replace />} />

          <Route path="/agent" element={<Agent><AgentHome /></Agent>} />
          <Route path="/agent/shops" element={<Agent><AgentShops /></Agent>} />
          <Route path="/agent/activate" element={<Agent><AgentActivate /></Agent>} />
          <Route path="/agent/assist" element={<Agent><AgentAssist /></Agent>} />

          <Route path="/admin" element={<AdminOnly><Admin /></AdminOnly>} />
          <Route path="/admin/clients" element={<AdminOnly><AdminClients /></AdminOnly>} />
          <Route path="/admin/groups" element={<AdminOnly><AdminGroups /></AdminOnly>} />
          <Route path="/admin/revenue" element={<AdminOnly><AdminRevenue /></AdminOnly>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </QueryClientProvider>
  );
}
