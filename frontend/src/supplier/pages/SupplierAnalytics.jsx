import { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function SupplierAnalytics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.supplier.analytics().then(setData).catch((e) => setError(e.message));
  }, []);
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Analytics</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="space-y-2">
        {(data?.groups || []).map((g) => (
          <div key={g.id} className="card text-sm">
            <div className="font-medium">{g.product_name}</div>
            <div className="text-gray-500">
              {g.current_quantity}/{g.target_quantity} · {g.order_count} orders · {g.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
