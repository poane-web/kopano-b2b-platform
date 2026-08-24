import BottomNav from '../components/BottomNav';

export default function Analytics() {
  const savingsData = [120, 280, 450, 620, 890, 1100, 1240];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
  const maxSavings = Math.max(...savingsData);
  
  const categories = [
    { name: 'Food', count: 42, color: 'bg-gray-900' },
    { name: 'Beauty', count: 28, color: 'bg-gray-600' },
    { name: 'Home', count: 18, color: 'bg-gray-400' },
    { name: 'Build', count: 12, color: 'bg-gray-300' },
  ];
  const maxCat = Math.max(...categories.map(c => c.count));
  
  return (
    <div className="pb-24">
      <h2 className="text-xl font-semibold mb-4">Analytics</h2>
      
      <div className="card mb-4">
        <div className="text-xs text-gray-500 mb-3">Savings over time (Pula)</div>
        <svg viewBox="0 0 360 140" className="w-full h-36">
          <line x1="30" y1="120" x2="350" y2="120" stroke="#e5e7eb" strokeWidth="1"/>
          <line x1="30" y1="80" x2="350" y2="80" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3,3"/>
          <line x1="30" y1="40" x2="350" y2="40" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3,3"/>
          
          <polyline 
            fill="none" 
            stroke="#111827" 
            strokeWidth="2.5" 
            points={savingsData.map((v, i) => `${30 + i * 50},${120 - (v / maxSavings) * 100}`).join(' ')}
          />
          {savingsData.map((v, i) => (
            <circle key={i} cx={30 + i * 50} cy={120 - (v / maxSavings) * 100} r="3" fill="#111827"/>
          ))}
          
          {months.map((m, i) => (
            <text key={i} x={30 + i * 50} y="135" fill="#9ca3af" fontSize="10" textAnchor="middle">{m}</text>
          ))}
        </svg>
      </div>
      
      <div className="card mb-4">
        <div className="text-xs text-gray-500 mb-3">Orders by category</div>
        <div className="flex items-end gap-2 h-32 px-2">
          {categories.map((cat, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <span className="text-xs font-medium">{cat.count}</span>
              <div className={`w-full ${cat.color} rounded-t-md`} style={{ height: `${(cat.count / maxCat) * 80}%` }}/>
              <span className="text-xs text-gray-500">{cat.name}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center py-4">
          <div className="text-2xl font-semibold">P4,820</div>
          <div className="text-xs text-gray-500 mt-1">Total saved</div>
        </div>
        <div className="card text-center py-4">
          <div className="text-2xl font-semibold">12</div>
          <div className="text-xs text-gray-500 mt-1">Groups joined</div>
        </div>
      </div>
      
      <BottomNav active="/analytics" />
    </div>
  );
}
