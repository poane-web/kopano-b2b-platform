import React, { useState, useEffect } from 'react';

// Main Navigation Header
function Navbar({ user, activeTab, setActiveTab, onLogout }) {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50 shadow-md font-sans">
      <div className="max-w-7xl mx-auto px-6 py-3.5 flex justify-between items-center">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('home')}>
          <div className="w-9 h-9 bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 rounded-xl flex items-center justify-center font-black text-lg shadow">
            K
          </div>
          <div>
            <span className="text-lg font-black tracking-tight block leading-none text-white">Kopano</span>
            <span className="text-[9px] text-emerald-400 font-bold tracking-wider uppercase">B2B Network</span>
          </div>
        </div>

        <nav className="flex items-center space-x-1 sm:space-x-2">
          <button 
            onClick={() => setActiveTab('deals')}
            className={`text-xs px-3 py-2 rounded-lg font-semibold transition ${
              activeTab === 'deals' ? 'bg-slate-800 text-emerald-400' : 'text-slate-300 hover:text-white'
            }`}
          >
            Group Pools
          </button>
          
          {user?.role === 'store_owner' && (
            <button 
              onClick={() => setActiveTab('orders')}
              className={`text-xs px-3 py-2 rounded-lg font-semibold transition ${
                activeTab === 'orders' ? 'bg-slate-800 text-emerald-400' : 'text-slate-300 hover:text-white'
              }`}
            >
              My Orders & Tracking
            </button>
          )}

          {user?.role === 'wholesaler' && (
            <button 
              onClick={() => setActiveTab('supplier_portal')}
              className={`text-xs px-3 py-2 rounded-lg font-bold transition ${
                activeTab === 'supplier_portal' ? 'bg-emerald-600 text-white' : 'bg-emerald-900/50 text-emerald-300 hover:bg-emerald-800/50'
              }`}
            >
              Wholesaler Portal
            </button>
          )}

          {user ? (
            <div className="flex items-center space-x-3 pl-3 border-l border-slate-800">
              <span className="text-xs font-bold text-white hidden sm:block">{user.businessName || user.name}</span>
              <button 
                onClick={onLogout}
                className="text-xs text-rose-400 hover:text-rose-300 font-semibold bg-rose-950/40 hover:bg-rose-900/50 px-2.5 py-1.5 rounded-lg transition border border-rose-800/40"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setActiveTab('register')}
              className="text-xs px-3.5 py-2 rounded-lg font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow ml-1"
            >
              Sign In
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}

// Deals & Smart Basket Component
function DealsScreen({ user, onAddToCart, basket }) {
  const [deals, setDeals] = useState([]);

  useEffect(() => {
    fetch('http://localhost:3000/api/deals')
      .then(res => res.json())
      .then(data => setDeals(data))
      .catch(() => {});
  }, []);

  return (
    <main className="max-w-7xl mx-auto p-6 font-sans">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Active Group Purchasing Pools</h1>
          <p className="text-slate-600 text-sm">Prices calculated dynamically against Recommended Retail Price (RRP).</p>
        </div>

        {/* Smart Basket Summary Widget */}
        {basket.length > 0 && (
          <div className="bg-emerald-900 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between gap-6">
            <div>
              <span className="text-[10px] text-emerald-400 font-bold uppercase block">Smart Restock Basket</span>
              <span className="text-sm font-extrabold">{basket.length} Item(s) Selected</span>
            </div>
            <button className="bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold px-4 py-2 rounded-xl transition">
              Checkout Basket
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {deals.map((deal) => {
          const progress = Math.round((deal.currentUnits / deal.targetUnits) * 100);

          return (
            <div key={deal.id} className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-lg shadow-slate-100 flex flex-col justify-between hover:shadow-xl transition-all">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
                    {deal.supplier}
                  </span>
                  <span className="text-xs text-rose-600 font-bold bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                    Save {deal.savingsPct}%
                  </span>
                </div>
                
                <h3 className="text-lg font-bold text-slate-900 mb-2">{deal.title}</h3>

                {/* Savings Engine Visualizer */}
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl mb-4">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-500 font-medium">Group Tier Price:</span>
                    <span className="text-2xl font-black text-emerald-600">{deal.groupPrice}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-slate-400 mt-0.5">
                    <span>MSRP / RRP Baseline:</span>
                    <span className="line-through">{deal.rrpPrice}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-xs text-slate-600 font-semibold mb-1">
                    <span>Pool Volume</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                  </div>
                </div>
              </div>

              {user?.role === 'store_owner' ? (
                <button 
                  onClick={() => onAddToCart(deal)}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs py-3 rounded-xl font-bold transition shadow flex items-center justify-center space-x-2"
                >
                  <span>+ Add to Smart Restock Basket</span>
                </button>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <span className="text-xs text-slate-600 font-medium">Sign in as Store Owner to place bulk orders.</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

// 5-Stage Visual Order Tracking Component
function OrdersScreen() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    fetch('http://localhost:3000/api/orders/my-orders')
      .then(res => res.json())
      .then(data => setOrders(data))
      .catch(() => {});
  }, []);

  const steps = ['Placed', 'Pool Filled', 'Dispatched', 'Sorting Hub', 'Delivered'];

  return (
    <main className="max-w-5xl mx-auto p-6 font-sans">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Order Tracking & Fulfillment</h1>
        <p className="text-slate-600 text-sm">Real-time status updates for active Kopano group orders.</p>
      </div>

      <div className="space-y-6">
        {orders.map((order) => (
          <div key={order.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{order.id} • {order.supplier}</span>
                <h3 className="text-lg font-bold text-slate-900">{order.title}</h3>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-emerald-600 block">{order.totalCost}</span>
                <span className="text-[11px] text-slate-500 font-semibold">ETA: {order.eta}</span>
              </div>
            </div>

            {/* 5-Step Order Stepper Visualizer */}
            <div className="mt-6">
              <div className="grid grid-cols-5 gap-2 text-center mb-2">
                {steps.map((label, idx) => {
                  const isComplete = idx + 1 <= order.statusStep;
                  return (
                    <span 
                      key={label} 
                      className={`text-[10px] font-bold uppercase tracking-tight ${
                        isComplete ? 'text-emerald-700' : 'text-slate-300'
                      }`}
                    >
                      {label}
                    </span>
                  );
                })}
              </div>

              <div className="grid grid-cols-5 gap-1.5 items-center">
                {steps.map((_, idx) => {
                  const isComplete = idx + 1 <= order.statusStep;
                  return (
                    <div 
                      key={idx} 
                      className={`h-2.5 rounded-full transition-all ${
                        isComplete ? 'bg-emerald-500 shadow-sm' : 'bg-slate-100'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

// Wholesaler Portal with CSV Bulk Upload Feature
function WholesalerPortal({ user }) {
  const [uploadResult, setUploadResult] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const res = await fetch('http://localhost:3000/api/wholesaler/bulk-upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setUploadResult(data);
      }
    } catch (err) {
      alert('CSV upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="max-w-5xl mx-auto p-6 font-sans">
      <div className="bg-slate-900 text-white rounded-3xl p-8 mb-8 shadow-xl flex justify-between items-center">
        <div>
          <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Wholesaler Operations</span>
          <h1 className="text-2xl font-extrabold mt-1">{user?.businessName || 'Wholesale Supplier Portal'}</h1>
          <p className="text-xs text-slate-400 mt-1">Upload inventory feeds via CSV or manual entries.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
        <h3 className="font-bold text-slate-900 text-lg mb-2">Bulk CSV Stock Import</h3>
        <p className="text-xs text-slate-500 mb-6">Avoid individual punching. Upload a CSV structured as: <code className="bg-slate-100 px-2 py-1 rounded text-slate-800">title, rrp, groupPrice, targetUnits</code></p>

        <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:border-emerald-500 transition cursor-pointer">
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleFileUpload}
            className="hidden" 
            id="csv-file-input"
          />
          <label htmlFor="csv-file-input" className="cursor-pointer">
            <span className="text-sm font-bold text-slate-700 block mb-1">
              {uploading ? 'Processing File...' : 'Click to Upload Stock CSV File'}
            </span>
            <span className="text-xs text-slate-400">Supports .csv feeds from Sage, QuickBooks, or Excel</span>
          </label>
        </div>

        {uploadResult && (
          <div className="mt-8 bg-slate-50 border border-slate-200 rounded-2xl p-6">
            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full uppercase tracking-wider">
              {uploadResult.message}
            </span>

            <div className="mt-4 space-y-2">
              {uploadResult.items.map(item => (
                <div key={item.id} className="p-3 bg-white border border-slate-200 rounded-xl flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-slate-900">{item.title}</span>
                    <span className="text-slate-400 block">Target: {item.targetUnits} units</span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-emerald-600 block">{item.groupPrice}</span>
                    <span className="text-slate-400 line-through">RRP: {item.rrp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// Master App Shell
export default function App() {
  const [activeTab, setActiveTab] = useState('deals');
  const [basket, setBasket] = useState([]);
  const [user, setUser] = useState(() => {
    return { id: 101, name: 'Thero M.', businessName: 'Kgale View General Dealer', role: 'store_owner' };
  });

  const handleAddToCart = (deal) => {
    setBasket(prev => [...prev, deal]);
  };

  const handleLogout = () => {
    setUser(null);
    setActiveTab('deals');
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased">
      <Navbar user={user} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />
      {activeTab === 'deals' && <DealsScreen user={user} onAddToCart={handleAddToCart} basket={basket} />}
      {activeTab === 'orders' && <OrdersScreen />}
      {activeTab === 'supplier_portal' && <WholesalerPortal user={user} />}
    </div>
  );
}
