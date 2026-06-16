import { NavLink, Route, Routes } from 'react-router-dom';
import { LayoutDashboard, Map, CheckCircle2, Clock3, KanbanSquare, Zap } from 'lucide-react';
import { cn } from './components/ui';
import Mapeamento from './pages/Mapeamento';
import Aprovacao from './pages/Aprovacao';
import Fila from './pages/Fila';
import Dashboard from './pages/Dashboard';
import Crm from './pages/Crm';

const tabs = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/crm', label: 'CRM', icon: KanbanSquare },
  { to: '/mapeamento', label: 'Mapeamento', icon: Map },
  { to: '/aprovacao', label: 'Aprovação', icon: CheckCircle2 },
  { to: '/fila', label: 'Fila de envio', icon: Clock3 },
];

export default function App() {
  return (
    <div className="min-h-screen bg-dot-grid bg-dot-grid">
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#07070b]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
          <div className="flex items-center gap-2 pr-4">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow-sm">
              <Zap className="h-4 w-4 text-white" />
            </span>
            <span className="text-base font-bold tracking-tight">
              ai<span className="text-brand-400">_</span>prospect
            </span>
          </div>
          <nav className="flex gap-1 overflow-x-auto text-sm">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 font-medium transition-all',
                    isActive
                      ? 'bg-white/[0.06] text-white ring-1 ring-white/[0.08]'
                      : 'text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-200',
                  )
                }
              >
                <t.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{t.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/crm" element={<Crm />} />
          <Route path="/mapeamento" element={<Mapeamento />} />
          <Route path="/aprovacao" element={<Aprovacao />} />
          <Route path="/fila" element={<Fila />} />
        </Routes>
      </main>
    </div>
  );
}
