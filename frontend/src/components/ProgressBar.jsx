export default function ProgressBar({ current, target, unit }) {
  const pct = Math.min(Math.round((current / target) * 100), 100);
  
  return (
    <div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-green-500' : 'bg-gray-900'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>{current} / {target} {unit}</span>
        <span className="font-medium">{pct}%</span>
      </div>
    </div>
  );
}
