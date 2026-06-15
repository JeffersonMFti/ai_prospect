import { useMetrics } from '../hooks/useMetrics';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const META_FECHAMENTO = 0.012; // 1,2%

function pct(v: number | null) {
  return v === null ? '—' : `${(v * 100).toFixed(1)}%`;
}

export default function Dashboard() {
  const { metrics, loading } = useMetrics();

  if (loading || !metrics) return <p className="text-zinc-400">Carregando métricas…</p>;

  const funil = [
    { etapa: 'Garimpados', valor: metrics.garimpados },
    { etapa: 'Enviados', valor: metrics.enviados },
    { etapa: 'Responderam', valor: metrics.responderam },
    { etapa: 'Fecharam', valor: metrics.fecharam },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Prontos p/ aprovar" value={metrics.prontos} accent="text-brand" />
        <Kpi label="Enviados" value={metrics.enviados} />
        <Kpi label="Taxa de resposta" value={pct(metrics.taxaResposta)} />
        <Kpi
          label="Taxa de fechamento"
          value={pct(metrics.taxaFechamento)}
          sub={`meta ${(META_FECHAMENTO * 100).toFixed(1)}%`}
          accent={
            metrics.taxaFechamento !== null && metrics.taxaFechamento >= META_FECHAMENTO
              ? 'text-emerald-400'
              : 'text-zinc-100'
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Kpi label="Receita gerada" value={`R$ ${metrics.receita.toLocaleString('pt-BR')}`} accent="text-emerald-400" />
        <Kpi label="Vendas fechadas" value={metrics.fecharam} />
        <Kpi label="Responderam" value={metrics.responderam} />
      </div>

      <div className="card">
        <h2 className="mb-4 text-sm font-semibold text-zinc-400">Funil</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={funil}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="etapa" stroke="#71717a" fontSize={12} />
            <YAxis stroke="#71717a" fontSize={12} allowDecimals={false} />
            <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} />
            <Bar dataKey="valor" fill="#6d28d9" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">Por nicho</h2>
        {metrics.porNicho.length === 0 ? (
          <p className="text-sm text-zinc-500">Sem dados ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="pb-2">Nicho</th>
                <th className="pb-2">Total</th>
                <th className="pb-2">Fechou</th>
              </tr>
            </thead>
            <tbody>
              {metrics.porNicho
                .sort((a, b) => b.total - a.total)
                .map((n) => (
                  <tr key={n.niche} className="border-t border-zinc-800">
                    <td className="py-2">{n.niche}</td>
                    <td className="py-2 text-zinc-400">{n.total}</td>
                    <td className="py-2 text-emerald-400">{n.fechou}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  accent = 'text-zinc-100',
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="card">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-3xl font-extrabold ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-600">{sub}</p>}
    </div>
  );
}
