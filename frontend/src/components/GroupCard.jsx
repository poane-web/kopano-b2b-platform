import { Link } from 'react-router-dom';

export default function GroupCard({ group }) {
  const pct = Math.min(100, Number(group.fill_percentage || 0));
  return (
    <Link to={`/groups/${group.id}`} className="block bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-gray-900">{group.product_name || group.name}</h3>
        <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{group.supplier_name}</span>
      </div>
      <p className="text-xs text-gray-500 mb-3">{group.description || 'Bulk purchasing group deal'}</p>
      <div className="flex justify-between text-sm mb-2">
        <span className="font-medium">P{group.unit_price}</span>
        <span className="text-gray-400 line-through">P{group.retail_price}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[11px] text-gray-500 mt-1">
        <span>
          {group.current_quantity}/{group.target_quantity} {group.unit}
        </span>
        <span>{pct}%</span>
      </div>
    </Link>
  );
}
