import { useParams, useNavigate } from 'react-router-dom';
import { useGroup } from '../hooks/useGroups';
import { useState } from 'react';

export default function GroupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: group, isLoading } = useGroup(id);
  const [quantity, setQuantity] = useState(1);
  
  if (isLoading) return <div className="p-4">Loading...</div>;
  if (!group) return <div className="p-4">Group not found</div>;
  
  const pct = Math.round(group.fill_percentage);
  const isFilled = pct >= 100;
  const savings = (group.retail_price - group.unit_price);
  
  function handleBuy() {
    navigate('/checkout', { 
      state: { 
        group: {
          id: group.id,
          product_name: group.product_name,
          unit_price: group.unit_price,
          retail_price: group.retail_price,
          unit: group.unit,
          pickup_location: group.pickup_location,
        },
        quantity 
      } 
    });
  }
  
  return (
    <div className="pb-24">
      <button onClick={() => navigate('/dashboard')} className="text-gray-500 text-sm mb-4">
        ← Back to groups
      </button>
      
      <div className="flex items-center gap-3 mb-4">
        <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center text-2xl">
          {group.category === 'food' ? '🌾' : group.category === 'construction' ? '🏗️' : group.category === 'beauty' ? '💇' : '📦'}
        </div>
        <div>
          <h1 className="text-lg font-semibold">{group.product_name}</h1>
          <p className="text-sm text-gray-500 capitalize">{group.category}</p>
        </div>
      </div>
      
      <div className="card mb-4">
        <div className="flex justify-between items-end mb-3">
          <div>
            <div className="text-sm text-gray-500">Group price</div>
            <div className="text-3xl font-semibold">P{group.unit_price}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Retail</div>
            <div className="text-gray-400 line-through">P{group.retail_price}</div>
          </div>
        </div>
        
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div 
            className={`h-full rounded-full ${isFilled ? 'bg-green-500' : 'bg-gray-900'}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-sm text-gray-500">
          <span>{group.current_quantity} / {group.target_quantity} {group.unit}</span>
          <span>{pct}%</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card text-center py-3">
          <div className="text-sm text-gray-500">Save per unit</div>
          <div className="text-lg font-semibold text-green-600">P{savings}</div>
        </div>
        <div className="card text-center py-3">
          <div className="text-sm text-gray-500">Members joined</div>
          <div className="text-lg font-semibold">{group.member_count || 0}</div>
        </div>
      </div>
      
      <div className="card mb-4">
        <div className="text-sm font-medium mb-2">How it works</div>
        <ol className="text-sm text-gray-500 space-y-1 list-decimal list-inside">
          <li>Place your order and pay</li>
          <li>We aggregate until the group fills</li>
          <li>Supplier delivers to hub</li>
          <li>You pick up your stock</li>
        </ol>
      </div>
      
      <div className="card mb-6">
        <div className="text-sm font-medium mb-1">Pickup location</div>
        <div className="text-sm text-gray-500">{group.pickup_location || 'Gaborone Central Hub'}</div>
        <div className="text-sm text-gray-400 mt-1">Mon-Fri, 08:00-17:00</div>
      </div>
      
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <div className="flex items-center gap-4 mb-3">
          <button 
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center font-medium"
          >−</button>
          <span className="text-xl font-semibold w-8 text-center">{quantity}</span>
          <button 
            onClick={() => setQuantity(quantity + 1)}
            className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center font-medium"
          >+</button>
          <div className="flex-1 text-right">
            <div className="text-sm text-gray-500">Total</div>
            <div className="text-xl font-semibold">P{quantity * group.unit_price}</div>
          </div>
        </div>
        <button onClick={handleBuy} className="btn-primary">
          Join this group
        </button>
      </div>
    </div>
  );
}
