import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Lead, Message } from '../lib/types';

type LeadComMensagem = Lead & { messages: Message[] };

const tierStyle: Record<string, string> = {
  quente: 'bg-red-500/15 text-red-300 border-red-500/30',
  morno: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  frio: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
};

export default function Aprovacao() {
  const [leads, setLeads] = useState<LeadComMensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error: e } = await supabase
      .from('leads')
      .select('*, messages(*)')
      .eq('status', 'pronto')
      .order('score', { ascending: false });
    setLoading(false);
    if (e) return setError(e.message);
    setLeads((data as LeadComMensagem[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function aprovar(lead: LeadComMensagem) {
    const msg = lead.messages[0];
    if (!msg) return;
    // Chama a Edge Function enqueue-sends: aprova a mensagem e agenda o envio
    // na fila respeitando o intervalo de 3 min (throttle anti-ban).
    const { error: e } = await supabase.functions.invoke('enqueue-sends', {
      body: { message_ids: [msg.id] },
    });
    if (e) {
      setError(`Falha ao agendar envio: ${e.message}`);
      return;
    }
    setLeads((prev) => prev.filter((l) => l.id !== lead.id));
  }

  async function descartar(lead: LeadComMensagem) {
    await supabase.from('leads').update({ status: 'descartado' }).eq('id', lead.id);
    setLeads((prev) => prev.filter((l) => l.id !== lead.id));
  }

  if (loading) return <p className="text-zinc-400">Carregando leads…</p>;
  if (error) return <p className="text-red-300">{error}</p>;
  if (leads.length === 0)
    return (
      <div className="card text-center text-zinc-400">
        Nenhum lead pronto para aprovação. Rode um mapeamento e aguarde a IA pontuar/escrever.
      </div>
    );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Aprovação — {leads.length} prontos</h1>
      {leads.map((lead) => (
        <CardLead key={lead.id} lead={lead} onAprovar={aprovar} onDescartar={descartar} />
      ))}
    </div>
  );
}

function CardLead({
  lead,
  onAprovar,
  onDescartar,
}: {
  lead: LeadComMensagem;
  onAprovar: (l: LeadComMensagem) => void;
  onDescartar: (l: LeadComMensagem) => void;
}) {
  const [showWhy, setShowWhy] = useState(false);
  const msg = lead.messages[0];

  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-lg font-semibold">{lead.name}</span>
        <span className={`rounded-full border px-2 py-0.5 text-xs ${tierStyle[lead.niche_tier ?? 'frio']}`}>
          {lead.niche ?? 'nicho?'} · {lead.niche_tier ?? '—'}
        </span>
        <span className="ml-auto rounded-md bg-zinc-800 px-2 py-1 text-sm font-bold text-brand">
          🔥 {lead.score ?? '—'}
        </span>
      </div>

      <div className="mt-1 text-xs text-zinc-500">
        {lead.phone ?? 'sem telefone'} · {lead.num_reviews ?? 0} avaliações · ⭐ {lead.rating ?? '—'}
        {lead.has_instagram && ' · usa Instagram'}
      </div>

      <p className="mt-3 whitespace-pre-wrap rounded-lg bg-zinc-950 p-3 text-sm text-zinc-200">
        {msg?.text ?? '(sem mensagem gerada)'}
      </p>

      {msg?.justification && (
        <div className="mt-2">
          <button onClick={() => setShowWhy((v) => !v)} className="text-xs text-brand hover:underline">
            {showWhy ? '▼' : '▶'} Por que essa mensagem? (raciocínio da IA)
          </button>
          {showWhy && (
            <div className="mt-1 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-400">
              {msg.justification}
              {lead.reasoning_score && (
                <p className="mt-2 border-t border-zinc-800 pt-2">
                  <strong>Nota:</strong> {lead.reasoning_score}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onAprovar(lead)}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          ✅ Aprovar e enviar
        </button>
        <button
          onClick={() => onDescartar(lead)}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          Descartar
        </button>
      </div>
    </div>
  );
}
