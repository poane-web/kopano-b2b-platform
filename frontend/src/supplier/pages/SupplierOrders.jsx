import { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function SupplierOrders() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    api.supplier.orders().then(setOrders).catch((e) => setError(e.message));
  }, []);
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Supplier orders</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="space-y-2">
        {orders.map((o) => (
          <div key={o.id} className="bg-white border rounded-xl p-3 text-sm">
            <div className="font-medium">{o.product_name}</div>
            <div className="text-gray-500">
              {o.order_number} · qty {o.quantity} · {o.status}
            </div>
          </div>
        ))}
        {orders.length === 0 && <p className="text-sm text-gray-500">No orders yet.</p>}
      </div>
    </div>
  );
}
