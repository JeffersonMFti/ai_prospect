import { NavLink, Route, Routes } from 'react-router-dom';
import Mapeamento from './pages/Mapeamento';
import Aprovacao from './pages/Aprovacao';
import Fila from './pages/Fila';
import Dashboard from './pages/Dashboard';

const tabs = [
  { to: '/', label: '📊 Dashboard', end: true },
  { to: '/mapeamento', label: '🗺️ Mapeamento' },
  { to: '/aprovacao', label: '✅ Aprovação' },
  { to: '/fila', label: '⏱️ Fila de envio' },
];

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <span className="text-lg font-bold text-brand">ai_prospect</span>
          <nav className="flex gap-1 text-sm">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 transition ${
                    isActive ? 'bg-brand text-white' : 'text-zinc-400 hover:bg-zinc-800'
                  }`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/mapeamento" element={<Mapeamento />} />
          <Route path="/aprovacao" element={<Aprovacao />} />
          <Route path="/fila" element={<Fila />} />
        </Routes>
      </main>
    </div>
  );
}
