import { useOnlineStatus } from '../hooks/useOnlineStatus';

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;
  return (
    <div className="bg-amber-soft border-b border-amber text-amber px-4 py-2 text-center z-30">
      <p className="text-sm font-medium">You are offline. Payments and live group data are unavailable until you reconnect.</p>
    </div>
  );
}
