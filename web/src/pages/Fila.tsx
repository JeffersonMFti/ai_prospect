import { useEffect, useState } from 'react';
import { Clock3, Timer, Inbox } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Send, Lead } from '../lib/types';
import { PageHeader, EmptyState, cn } from '../components/ui';

type SendComLead = Send & { leads: Pick<Lead, 'name' | 'phone'> | null };

const statusStyle: Record<string, string> = {
  agendado: 'bg-amber-500/15 text-amber-300 ring-amber-500/25',
  enviado: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25',
  falhou: 'bg-rose-500/15 text-rose-300 ring-rose-500/25',
  cancelado: 'bg-zinc-500/15 text-zinc-400 ring-zinc-500/25',
};

export default function Fila() {
  const [sends, setSends] = useState<SendComLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  async function load() {
    const { data } = await supabase
      .from('sends')
      .select('*, leads(name, phone)')
      .order('scheduled_at', { ascending: true })
      .limit(100);
    setSends((data as SendComLead[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const refresh = setInterval(load, 15_000);
    return () => {
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, []);

  const proximo = sends.find((s) => s.status === 'agendado');
  const countdown = proximo ? Math.max(0, Math.floor((new Date(proximo.scheduled_at).getTime() - now) / 1000)) : null;

  return (
    <div className="space-y-5">
      <PageHeader icon={Clock3} title="Fila de envio" subtitle="1 mensagem a cada 3 minutos · anti-ban" />

      {countdown !== null && (
        <div className="card-gradient flex items-center justify-center gap-4 text-center">
          <Timer className="h-8 w-8 text-brand-400 animate-pulse-glow" />
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500">Próximo envio em</p>
            <p className="font-mono text-4xl font-extrabold tracking-tight text-gradient">
              {String(Math.floor(countdown / 60)).padStart(2, '0')}:{String(countdown % 60).padStart(2, '0')}
            </p>
            <p className="text-xs text-zinc-500">para {proximo?.leads?.name}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card"><div className="skeleton h-40 w-full" /></div>
      ) : sends.length === 0 ? (
        <EmptyState icon={Inbox} title="Fila vazia" description="Aprove leads na aba Aprovação para agendar os envios." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">
                <th className="pb-3 font-medium">Empresa</th>
                <th className="pb-3 font-medium">Agendado</th>
                <th className="pb-3 font-medium">Enviado</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sends.map((s) => (
                <tr key={s.id} className="border-t border-white/[0.06] transition hover:bg-white/[0.02]">
                  <td className="py-3 font-medium text-zinc-200">{s.leads?.name ?? '—'}</td>
                  <td className="py-3 text-zinc-500">{new Date(s.scheduled_at).toLocaleString('pt-BR')}</td>
                  <td className="py-3 text-zinc-500">{s.sent_at ? new Date(s.sent_at).toLocaleTimeString('pt-BR') : '—'}</td>
                  <td className="py-3">
                    <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium ring-1', statusStyle[s.status])}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
