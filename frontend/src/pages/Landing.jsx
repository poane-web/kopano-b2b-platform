import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="min-h-screen bg-ink text-paper">
      <header className="flex items-center justify-between px-5 py-4 max-w-app mx-auto">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-lg bg-leaf font-extrabold grid place-items-center">K</span>
          <span className="font-extrabold text-lg tracking-tight">Kopano</span>
        </div>
        <div className="flex gap-2">
          <Link to="/auth" className="hidden sm:inline-flex px-4 py-2 text-sm font-semibold text-paper/80 hover:text-paper">
            Log in
          </Link>
          <Link to="/wholesaler/login" className="px-4 py-2 text-sm font-semibold rounded-lg bg-white/10 hover:bg-white/15">
            Wholesaler
          </Link>
        </div>
      </header>

      <main className="px-5 pt-10 pb-16 max-w-app mx-auto">
        <p className="label text-leaf mb-3">Botswana B2B group buying</p>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] max-w-2xl">
          Pool demand. Unlock wholesale prices.
        </h1>
        <p className="mt-4 text-paper/75 max-w-xl text-base leading-relaxed">
          Kopano lets shops across Botswana buy together. Join a buying group, pay in Pula, and pick up stock at a
          local hub — without needing a full container on your own.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md">
          <Link to="/auth" className="btn-primary bg-leaf hover:bg-forest-light">
            Register your shop
          </Link>
          <Link to="/auth" className="btn-secondary bg-transparent text-paper border-white/20 hover:bg-white/10">
            I already have an account
          </Link>
        </div>

        <div className="mt-14 grid sm:grid-cols-3 gap-4">
          {[
            { t: 'Clients', d: 'Tuckshops, salons, caterers and builders join open groups and pay with Orange Money.' },
            { t: 'Wholesalers', d: 'Fill groups faster, confirm orders, and dispatch to pickup hubs.' },
            { t: 'Agents', d: 'Activate shops in your region and help them place their first order.' },
          ].map((item) => (
            <div key={item.t} className="rounded-xl border border-white/10 bg-white/5 p-5">
              <div className="text-leaf text-xs font-bold uppercase tracking-wider">{item.t}</div>
              <p className="mt-2 text-sm text-paper/80 leading-relaxed">{item.d}</p>
            </div>
          ))}
        </div>
      </main>
      <footer className="px-5 py-8 max-w-app mx-auto text-sm text-paper/50 border-t border-white/10">
        Agents and administrators use the same phone + PIN login as clients. After sign-in, Kopano opens the workspace
        for your role.
      </footer>
    </div>
  );
}
