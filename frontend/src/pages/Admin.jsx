import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.admin
      .stats()
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold">Admin</h1>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      {stats && (
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="card">
            <div className="text-xs text-gray-500">Users</div>
            <div className="text-xl font-semibold">{stats.totalUsers}</div>
          </div>
          <div className="card">
            <div className="text-xs text-gray-500">Revenue</div>
            <div className="text-xl font-semibold">P{stats.totalRevenue}</div>
          </div>
          <div className="card">
            <div className="text-xs text-gray-500">Open groups</div>
            <div className="text-xl font-semibold">{stats.activeGroups}</div>
          </div>
          <div className="card">
            <div className="text-xs text-gray-500">Avg fill</div>
            <div className="text-xl font-semibold">{stats.avgFillRate}%</div>
          </div>
        </div>
      )}
    </div>
  );
}
