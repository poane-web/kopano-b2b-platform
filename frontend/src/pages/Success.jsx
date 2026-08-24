import { useLocation, Link } from 'react-router-dom';

export default function Success() {
  const location = useLocation();
  const total = location.state?.total || 0;
  const orderId = location.state?.orderId || '';
  
  return (
    <div className="min-h-screen bg-white px-6 py-16 text-center">
      <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      
      <h2 className="text-2xl font-semibold mb-2">Order placed!</h2>
      <p className="text-gray-500 mb-2">
        Your payment of <strong>P{total}</strong> has been received.
      </p>
      {orderId && <p className="text-sm text-gray-400 mb-8">Order: {orderId}</p>}
      
      <p className="text-sm text-gray-500 mb-8">
        You will be notified when the group fills and your stock is ready for pickup.
      </p>
      
      <div className="space-y-3">
        <Link to="/orders" className="btn-primary block">View my orders</Link>
        <Link to="/dashboard" className="btn-secondary block">Back to groups</Link>
      </div>
    </div>
  );
}
