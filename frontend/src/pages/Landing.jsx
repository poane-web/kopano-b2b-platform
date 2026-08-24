import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between p-6 max-w-lg mx-auto">
      <div className="pt-12 text-center">
        <div className="w-16 h-16 bg-green-600 text-white font-bold text-2xl rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-md">
          K
        </div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Kopano</h1>
        <p className="text-gray-600 mt-3 text-sm leading-relaxed">
          Bulk purchasing platform for local businesses. Pool demand, unlock lower prices, and earn rewards.
        </p>
      </div>

      <div className="space-y-3 pb-8">
        <Link 
          to="/dashboard" 
          className="w-full bg-gray-900 text-white font-medium py-3 rounded-xl flex items-center justify-center shadow"
        >
          Go to Dashboard
        </Link>
        <Link 
          to="/referrals" 
          className="w-full bg-white text-gray-900 border border-gray-300 font-medium py-3 rounded-xl flex items-center justify-center"
        >
          View Referrals & Rewards
        </Link>
      </div>
    </div>
  );
}
