export default function GroupCard({ group }) {
  return (
    <div className="card mb-3 p-4 bg-white rounded-lg border border-gray-200">
      <h3 className="font-semibold text-gray-900">{group?.name || 'Sample Group Deal'}</h3>
      <p className="text-xs text-gray-500 mt-1">{group?.description || 'Bulk purchasing group deal'}</p>
    </div>
  );
}
