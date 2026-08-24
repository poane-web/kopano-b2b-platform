import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const group = location.state?.group;
  const [qty, setQty] = useState(2);
  const [method, setMethod] = useState('orange_money');
  const [paying, setPaying] = useState(false);

  if (!group) return <div className="p-4">No group selected</div>;

  const total = qty * group.unit_price;
  const savings = qty * (group.retail_price - group.unit_price);

  async function handlePay() {
    setPaying(true);
    try {
      const order = await api.orders.create({
        groupId: group.id,
        quantity: qty,
        paymentMethod: method,
      });
      
      if (method === 'orange_money') {
        await api.payments.orangeMoney(order.id, '+26771234567');
      }
      
      navigate('/success', { state: { total, orderId: order.id } });
    } catch (err) {
      alert(err.message);
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="pb-24">
      <h2 className="text-xl font-medium mb-5">Place order</h2>
      
      <div className="bg-white border rounded-xl p-4 mb-4">
        <div className="flex justify-between mb-2">
          <span className="text-gray-500">{group.product_name}</span>
          <span className="font-medium">P{group.unit_price}/unit</span>
        </div>
        <div className="flex items-center gap-3 my-3">
          <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center border">−</button>
          <span className="text-lg font-medium w-10 text-center">{qty}</span>
          <button onClick={() => setQty(qty + 1)} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center border">+</button>
        </div>
        <div className="flex justify-between pt-3 border-t">
          <span className="text-gray-500">You save vs retail</span>
          <span className="text-green-600 font-medium">P{savings}</span>
        </div>
      </div>

      <div className="text-sm font-medium mb-2.5">Payment method</div>
      <div className="flex flex-col gap-2 mb-5">
        {['orange_money', 'mascom_wallet', 'card'].map(m => (
          <label key={m} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer ${
            method === m ? 'border-gray-900 bg-gray-50' : 'border-gray-200'
          }`}>
            <input type="radio" name="pay" checked={method === m} onChange={() => setMethod(m)} className="accent-gray-900" />
            <span className="font-medium capitalize">{m.replace('_', ' ')}</span>
          </label>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <div className="flex justify-between mb-3">
          <span className="text-gray-500">Total to pay</span>
          <span className="text-xl font-medium">P{total}</span>
        </div>
        <button 
          onClick={handlePay} 
          disabled={paying}
          className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium disabled:opacity-50"
        >
          {paying ? 'Processing...' : 'Pay now'}
        </button>
      </div>
    </div>
  );
}