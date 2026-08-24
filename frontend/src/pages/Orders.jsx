import { useEffect, useState } from 'react';
import { api } from '../api/client';
import BottomNav from '../components/BottomNav';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    api.orders.my().then(data => {
      setOrders(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);
  
  if (loading) return <div className="p-4 pb-24"><BottomNav active="/orders" /></div>;
  
  const statusColors = {
    delivered: 'bg-green-50 text-green-700',
    ready_pickup: 'bg-blue-50 text-blue-700',
    pending_payment: 'bg-amber-50 text-amber-700',
    paid: 'bg-gray-100 text-gray-600',
    group_filling: 'bg-purple-50 text-purple-700',
  };
  
  const statusLabels = {
    delivered: 'Delivered',
    ready_pickup: 'Ready for pickup',
    pending_payment: 'Awaiting payment',
    paid: 'Paid - group filling',
    group_filling: 'Group filling',
  };
  
  return (
    <div className="pb-24">
      <h2 className="text-xl font-semibold mb-4">My orders</h2>
      
      {orders.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No orders yet.</p>
          <p className="text-sm mt-1">Browse groups to start saving.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            <div key={order.id} className="card">
              <div className="flex justify-between text-xs text-gray-400 mb-2">
                <span>{order.order_number}</span>
                <span>{new Date(order.created_at).toLocaleDateString('en-GB')}</span>
              </div>
              <div className="font-medium mb-1">{order.product_name}</div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Qty: {order.quantity}</span>
                <span className="font-medium">P{order.total_amount}</span>
              </div>
              <div className="mt-2">
                <span className={`text-xs px-2.5 py-1 rounded-md font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-600'}`}>
                  {statusLabels[order.status] || order.status}
                </span>
              </div>
              {order.pickup_code && order.status === 'ready_pickup' && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Pickup code</div>
                  <div className="text-lg font-mono font-semibold tracking-wider">{order.pickup_code}</div>
                  <div className="text-xs text-gray-500 mt-1">{order.pickup_location}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      <BottomNav active="/orders" />
    </div>
  );
}
