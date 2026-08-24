import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';

export default function SupplierDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.supplier.dashboard().then(setData).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="pb-8">
      <h2 className="text-xl font-semibold mb-4">Supplier dashboard</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {data && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white border rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500">Groups</div>
            <div className="text-lg font-semibold">{data.groups}</div>
          </div>
          <div className="bg-white border rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500">Orders</div>
            <div className="text-lg font-semibold">{data.orders}</div>
          </div>
          <div className="bg-white border rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500">Payout est.</div>
            <div className="text-lg font-semibold">P{data.estimatedPayout}</div>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-2 text-sm">
        <Link to="/supplier/orders" className="underline">Orders</Link>
        <Link to="/supplier/analytics" className="underline">Analytics</Link>
        <Link to="/supplier/delivery" className="underline">Deliveries</Link>
      </div>
    </div>
  );
}
