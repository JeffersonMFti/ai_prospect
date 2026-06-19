import { useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, Map, CheckCircle2, Clock3, KanbanSquare, Settings2, Zap, Menu, X, Github,
} from 'lucide-react';
import { cn } from './components/ui';
import { pageTransition } from './lib/motion';
import Mapeamento from './pages/Mapeamento';
import Aprovacao from './pages/Aprovacao';
import Fila from './pages/Fila';
import Dashboard from './pages/Dashboard';
import Crm from './pages/Crm';
import Configuracoes from './pages/Configuracoes';

const tabs = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/crm', label: 'CRM', icon: KanbanSquare },
  { to: '/mapeamento', label: 'Mapeamento', icon: Map },
  { to: '/aprovacao', label: 'Aprovação', icon: CheckCircle2 },
  { to: '/fila', label: 'Fila de envio', icon: Clock3 },
  { to: '/config', label: 'Configurações', icon: Settings2 },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow-sm">
        <Zap className="h-[18px] w-[18px] text-white" />
      </span>
      <span className="text-[15px] font-bold tracking-tight">
        ai<span className="text-brand-400">_</span>prospect
      </span>
    </div>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-200',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-xl border border-white/[0.08] bg-white/[0.06]"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <t.icon className={cn('relative z-10 h-[18px] w-[18px] transition-colors', isActive && 'text-brand-300')} />
              <span className="relative z-10">{t.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export default function App() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-dot-grid">
      {/* Sidebar — desktop */}
      <aside className="panel fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r px-4 py-5 lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <div className="mt-8 flex-1">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">Navegação</p>
          <NavItems />
        </div>
        <div className="mt-auto space-y-3 px-1">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-[11px] font-medium text-zinc-400">Prospecção B2B com IA</p>
            <p className="mt-0.5 text-[11px] text-zinc-600">scraper · scoring · WhatsApp</p>
          </div>
          <a
            href="https://github.com/JeffersonMFti/ai_prospect"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-2 text-xs text-zinc-600 transition-colors hover:text-zinc-300"
          >
            <Github className="h-3.5 w-3.5" /> Ver no GitHub
          </a>
        </div>
      </aside>

      {/* Topbar — mobile */}
      <header className="panel sticky top-0 z-40 flex items-center justify-between border-b px-4 py-3 lg:hidden">
        <Logo />
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-zinc-300"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Drawer — mobile */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 36 }}
              className="panel fixed inset-y-0 left-0 z-[60] flex w-[280px] flex-col border-r px-4 py-5 lg:hidden"
            >
              <div className="flex items-center justify-between px-2">
                <Logo />
                <button onClick={() => setMobileOpen(false)} className="p-1 text-zinc-500 hover:text-zinc-200" aria-label="Fechar menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-8">
                <NavItems onNavigate={() => setMobileOpen(false)} />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Conteúdo */}
      <main className="lg:pl-[260px]">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={pageTransition}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              <Routes location={location}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/crm" element={<Crm />} />
                <Route path="/mapeamento" element={<Mapeamento />} />
                <Route path="/aprovacao" element={<Aprovacao />} />
                <Route path="/fila" element={<Fila />} />
                <Route path="/config" element={<Configuracoes />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
