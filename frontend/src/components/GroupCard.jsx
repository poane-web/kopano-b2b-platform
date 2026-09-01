import { Link } from 'react-router-dom';
import { formatDeadline, money } from '../lib/format';
import { useNow } from '../hooks/useOnlineStatus';

export default function GroupCard({ group }) {
  const now = useNow(30000);
  const pct = Math.min(100, Number(group.fill_percentage || 0));
  const remaining =
    group.remaining_quantity ?? Math.max(0, (group.target_quantity || 0) - (group.current_quantity || 0));
  const deadline = formatDeadline(group.deadline, now);
  const filled = pct >= 100;
  const closed = deadline === 'Closed';

  return (
    <Link to={`/groups/${group.id}`} className="card block hover:shadow-lift transition-shadow">
      <div className="flex justify-between items-start gap-3 mb-2">
        <div>
          <h3 className="font-bold text-ink leading-snug">{group.product_name || group.name}</h3>
          <p className="text-xs text-muted mt-0.5 capitalize">
            {group.supplier_name || 'Wholesaler'} · {group.category}
          </p>
        </div>
        <span
          className={`text-xs font-semibold px-2 py-1 rounded-md whitespace-nowrap ${
            closed ? 'bg-danger-soft text-danger' : filled ? 'bg-success-soft text-success' : 'bg-success-soft text-forest'
          }`}
        >
          {deadline || (filled ? 'Filled' : 'Open')}
        </span>
      </div>
      {group.description && <p className="text-sm text-muted mb-3 line-clamp-2">{group.description}</p>}
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted font-semibold">Wholesale</div>
          <div className="text-xl font-extrabold">{money(group.unit_price)}</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wider text-muted font-semibold">Retail</div>
          <div className="text-sm text-muted line-through">{money(group.retail_price)}</div>
        </div>
      </div>
      <div className="h-1.5 bg-clay rounded-full overflow-hidden">
        <div className={`h-full ${filled ? 'bg-success' : 'bg-forest'}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted mt-1.5">
        <span>
          {group.current_quantity}/{group.target_quantity} {group.unit}
        </span>
        <span>
          {remaining} remaining · {pct}%
        </span>
      </div>
    </Link>
  );
}
