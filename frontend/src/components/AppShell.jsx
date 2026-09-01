import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { initials } from '../lib/format';
import OfflineBanner from './OfflineBanner';

const CUSTOMER_NAV = [
  { to: '/app', label: 'Home', icon: HomeIcon, end: true },
  { to: '/buy', label: 'Buy', icon: GridIcon },
  { to: '/orders', label: 'Orders', icon: DocIcon },
  { to: '/rewards', label: 'Rewards', icon: GiftIcon },
  { to: '/profile', label: 'Profile', icon: UserIcon },
];

const WHOLESALER_NAV = [
  { to: '/wholesaler', label: 'Overview', icon: HomeIcon, end: true },
  { to: '/wholesaler/groups', label: 'Groups', icon: GridIcon },
  { to: '/wholesaler/orders', label: 'Orders', icon: DocIcon },
  { to: '/wholesaler/catalogue', label: 'Catalogue', icon: BoxIcon },
  { to: '/wholesaler/deliveries', label: 'Deliveries', icon: TruckIcon },
  { to: '/wholesaler/analytics', label: 'Analytics', icon: ChartIcon },
  { to: '/wholesaler/profile', label: 'Profile', icon: UserIcon },
];

const AGENT_NAV = [
  { to: '/agent', label: 'Home', icon: HomeIcon, end: true },
  { to: '/agent/shops', label: 'Shops', icon: StoreIcon },
  { to: '/agent/activate', label: 'Activate', icon: PlusIcon },
  { to: '/agent/assist', label: 'Assist', icon: DocIcon },
  { to: '/profile', label: 'Profile', icon: UserIcon },
];

const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', icon: HomeIcon, end: true },
  { to: '/admin/clients', label: 'Clients', icon: UserIcon },
  { to: '/admin/groups', label: 'Groups', icon: GridIcon },
  { to: '/admin/revenue', label: 'Revenue', icon: ChartIcon },
  { to: '/profile', label: 'Profile', icon: UserIcon },
];

function navFor(role) {
  if (role === 'supplier') return WHOLESALER_NAV;
  if (role === 'agent') return AGENT_NAV;
  if (role === 'admin') return ADMIN_NAV;
  return CUSTOMER_NAV;
}

function roleLabel(role) {
  if (role === 'supplier') return 'Wholesaler';
  if (role === 'agent') return 'Agent';
  if (role === 'admin') return 'Admin';
  return 'Client';
}

export default function AppShell() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const role = user?.role || 'customer';
  const items = navFor(role);
  const name = user?.business_name || user?.name || 'Kopano account';
  const location = useLocation();
  const hideBottom = location.pathname.startsWith('/checkout') || location.pathname.startsWith('/groups/');

  return (
    <div className="min-h-screen bg-sand text-ink">
      <OfflineBanner />
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-64 bg-ink text-paper">
        <Link to={items[0].to} className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
          <span className="w-9 h-9 rounded-lg bg-leaf text-paper font-extrabold grid place-items-center">K</span>
          <div>
            <div className="font-extrabold tracking-tight">Kopano</div>
            <div className="text-[11px] text-paper/60 uppercase tracking-wider">{roleLabel(role)}</div>
          </div>
        </Link>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium min-h-[44px] ${
                  isActive ? 'bg-white/10 text-paper' : 'text-paper/70 hover:bg-white/5 hover:text-paper'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-leaf/80 grid place-items-center text-xs font-bold">
              {initials(name)}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{name}</div>
              <div className="text-[11px] text-paper/50 truncate">{user?.phone || user?.email || ''}</div>
            </div>
          </div>
          <button type="button" onClick={logout} className="text-xs text-paper/60 hover:text-paper">
            Log out
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="lg:hidden sticky top-0 z-20 bg-ink text-paper px-4 py-3 flex items-center justify-between">
          <Link to={items[0].to} className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-md bg-leaf font-extrabold grid place-items-center">K</span>
            <span className="font-extrabold">Kopano</span>
          </Link>
          <span className="text-[11px] uppercase tracking-wider text-paper/60">{roleLabel(role)}</span>
        </header>
        <main className={`max-w-app mx-auto px-4 pt-5 ${hideBottom ? 'pb-8' : 'pb-28'} lg:px-8 lg:pt-8 lg:pb-12`}>
          <Outlet />
        </main>
      </div>

      {!hideBottom && (
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-paper border-t border-line">
          <div className="flex justify-around px-1 py-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {items.slice(0, 5).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2 px-2 min-w-[56px] min-h-[44px] text-[11px] font-semibold ${
                    isActive ? 'text-forest' : 'text-muted'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

function HomeIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z" />
    </svg>
  );
}
function GridIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function DocIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}
function GiftIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13M3 12v8a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-8" />
      <path d="M12 8H8.5a2.5 2.5 0 1 1 0-5C11 3 12 8 12 8z" />
      <path d="M12 8h3.5a2.5 2.5 0 1 0 0-5C13 3 12 8 12 8z" />
    </svg>
  );
}
function UserIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19a7 7 0 0 1 14 0" />
    </svg>
  );
}
function BoxIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 8 12 3 3 8l9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
    </svg>
  );
}
function TruckIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7h11v10H3z" />
      <path d="M14 11h4l3 3v3h-7" />
      <circle cx="7" cy="18" r="1.5" />
      <circle cx="17" cy="18" r="1.5" />
    </svg>
  );
}
function ChartIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 16v-5" />
      <path d="M12 16V8" />
      <path d="M16 16v-8" />
    </svg>
  );
}
function StoreIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 10h16v10H4z" />
      <path d="M4 10 6 4h12l2 6" />
      <path d="M10 20v-6h4v6" />
    </svg>
  );
}
function PlusIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
