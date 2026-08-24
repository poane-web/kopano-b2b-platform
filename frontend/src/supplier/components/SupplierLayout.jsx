import { Outlet } from 'react-router-dom';

export default function SupplierLayout() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <h1 className="text-xl font-bold mb-4">Supplier Portal</h1>
      <Outlet />
    </div>
  );
}
