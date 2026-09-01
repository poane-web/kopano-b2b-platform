export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted">
      <div className="h-8 w-8 rounded-full border-2 border-line border-t-forest animate-spin" />
      <p className="text-sm">{label}…</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="card border-danger/30 bg-danger-soft text-center">
      <p className="text-sm text-danger font-medium">{message || 'Something went wrong.'}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-secondary mt-3 max-w-xs mx-auto">
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="card-muted text-center py-10 px-6">
      <p className="font-semibold text-ink">{title}</p>
      {body && <p className="text-sm text-muted mt-1">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatusBadge({ tone = 'neutral', children }) {
  const map = {
    ok: 'bg-success-soft text-success',
    warn: 'bg-amber-soft text-amber',
    bad: 'bg-danger-soft text-danger',
    neutral: 'bg-clay text-ink',
  };
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-md ${map[tone] || map.neutral}`}>
      {children}
    </span>
  );
}

export function Stat({ label, value, hint }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className="text-xl font-extrabold tracking-tight mt-1 text-ink">{value}</div>
      {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
    </div>
  );
}

export function PageHeader({ kicker, title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        {kicker && <div className="label mb-1">{kicker}</div>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1 max-w-xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
