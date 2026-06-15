import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Send, Lead } from '../lib/types';

type SendComLead = Send & { leads: Pick<Lead, 'name' | 'phone'> | null };

const statusStyle: Record<string, string> = {
  agendado: 'text-amber-300',
  enviado: 'text-emerald-400',
  falhou: 'text-red-400',
  cancelado: 'text-zinc-500',
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

  if (loading) return <p className="text-zinc-400">Carregando fila…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Fila de envio</h1>

      {countdown !== null && (
        <div className="card text-center">
          <p className="text-sm text-zinc-400">Próximo envio em</p>
          <p className="text-4xl font-extrabold text-brand">
            {String(Math.floor(countdown / 60)).padStart(2, '0')}:{String(countdown % 60).padStart(2, '0')}
          </p>
          <p className="text-xs text-zinc-500">para {proximo?.leads?.name}</p>
        </div>
      )}

      {sends.length === 0 ? (
        <div className="card text-center text-zinc-400">Nada na fila. Aprove leads na aba Aprovação.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="pb-2">Empresa</th>
                <th className="pb-2">Agendado</th>
                <th className="pb-2">Enviado</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {sends.map((s) => (
                <tr key={s.id} className="border-t border-zinc-800">
                  <td className="py-2">{s.leads?.name ?? '—'}</td>
                  <td className="py-2 text-zinc-400">{new Date(s.scheduled_at).toLocaleString('pt-BR')}</td>
                  <td className="py-2 text-zinc-400">
                    {s.sent_at ? new Date(s.sent_at).toLocaleTimeString('pt-BR') : '—'}
                  </td>
                  <td className={`py-2 font-medium ${statusStyle[s.status]}`}>{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
