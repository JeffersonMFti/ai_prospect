import { LayoutDashboard, Sparkles, Send, MessageCircle, DollarSign, Target, TrendingUp, Trophy } from 'lucide-react';
import { useMetrics } from '../hooks/useMetrics';
import { Kpi, PageHeader } from '../components/ui';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

const META_FECHAMENTO = 0.012;

function pct(v: number | null) {
  return v === null ? '—' : `${(v * 100).toFixed(1)}%`;
}

export default function Dashboard() {
  const { metrics, loading } = useMetrics();

  if (loading || !metrics) {
    return (
      <div className="animate-fade-in space-y-6">
        <PageHeader icon={LayoutDashboard} title="Dashboard" subtitle="Carregando métricas…" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card"><div className="skeleton h-16 w-full" /></div>
          ))}
        </div>
      </div>
    );
  }

  const funil = [
    { etapa: 'Garimpados', valor: metrics.garimpados },
    { etapa: 'Enviados', valor: metrics.enviados },
    { etapa: 'Responderam', valor: metrics.responderam },
    { etapa: 'Fecharam', valor: metrics.fecharam },
  ];
  const metaOk = metrics.taxaFechamento !== null && metrics.taxaFechamento >= META_FECHAMENTO;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader icon={LayoutDashboard} title="Dashboard" subtitle="Visão geral da sua máquina de prospecção" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Prontos p/ aprovar" value={metrics.prontos} icon={Sparkles} accent="text-brand-300" />
        <Kpi label="Enviados" value={metrics.enviados} icon={Send} iconCls="bg-sky-500/10 text-sky-400" />
        <Kpi label="Taxa de resposta" value={pct(metrics.taxaResposta)} icon={MessageCircle} iconCls="bg-amber-500/10 text-amber-400" />
        <Kpi
          label="Taxa de fechamento"
          value={pct(metrics.taxaFechamento)}
          sub={`meta ${(META_FECHAMENTO * 100).toFixed(1)}%`}
          icon={Target}
          accent={metaOk ? 'text-emerald-400' : 'text-zinc-100'}
          iconCls={metaOk ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-500/10 text-zinc-400'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Kpi label="Receita gerada" value={`R$ ${metrics.receita.toLocaleString('pt-BR')}`} icon={DollarSign} accent="text-emerald-400" iconCls="bg-emerald-500/10 text-emerald-400" />
        <Kpi label="Vendas fechadas" value={metrics.fecharam} icon={Trophy} iconCls="bg-amber-500/10 text-amber-400" />
        <Kpi label="Responderam" value={metrics.responderam} icon={TrendingUp} iconCls="bg-sky-500/10 text-sky-400" />
      </div>

      <div className="card">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-zinc-400">Funil de conversão</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={funil} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="etapa" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#71717a" fontSize={12} allowDecimals={false} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              contentStyle={{ background: '#101014', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }}
            />
            <Bar dataKey="valor" radius={[8, 8, 0, 0]} maxBarSize={90}>
              {funil.map((_, i) => (
                <Cell key={i} fill={i === 3 ? '#34d399' : 'url(#barGrad)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">Por nicho</h2>
        {metrics.porNicho.length === 0 ? (
          <p className="text-sm text-zinc-500">Sem dados ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">
                <th className="pb-3 font-medium">Nicho</th>
                <th className="pb-3 font-medium">Total</th>
                <th className="pb-3 font-medium">Fechou</th>
              </tr>
            </thead>
            <tbody>
              {metrics.porNicho
                .sort((a, b) => b.total - a.total)
                .map((n) => (
                  <tr key={n.niche} className="border-t border-white/[0.06]">
                    <td className="py-2.5 capitalize text-zinc-200">{n.niche}</td>
                    <td className="py-2.5 text-zinc-500">{n.total}</td>
                    <td className="py-2.5 font-medium text-emerald-400">{n.fechou}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
