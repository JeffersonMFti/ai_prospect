import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, Star, MessageSquare, Phone, Instagram, Brain,
  Send, X, ChevronDown, Inbox,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Lead, Message } from '../lib/types';
import { PageHeader, TierBadge, ScorePill, EmptyState, Spinner, cn } from '../components/ui';

type LeadComMensagem = Lead & { messages: Message[] };

export default function Aprovacao() {
  const [leads, setLeads] = useState<LeadComMensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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
    setBusy(lead.id);
    const { error: e } = await supabase.functions.invoke('enqueue-sends', { body: { message_ids: [msg.id] } });
    setBusy(null);
    if (e) return setError(`Falha ao agendar envio: ${e.message}`);
    setLeads((prev) => prev.filter((l) => l.id !== lead.id));
  }

  async function descartar(lead: LeadComMensagem) {
    await supabase.from('leads').update({ status: 'descartado' }).eq('id', lead.id);
    setLeads((prev) => prev.filter((l) => l.id !== lead.id));
  }

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        icon={CheckCircle2}
        title="Aprovação"
        subtitle={loading ? 'Carregando…' : `${leads.length} leads prontos · do mais quente ao mais morno`}
      />

      {error && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] p-4 text-sm text-rose-300">{error}</div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card space-y-3">
              <div className="skeleton h-5 w-1/3" />
              <div className="skeleton h-20 w-full" />
            </div>
          ))}
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nenhum lead pronto"
          description="Rode um mapeamento e deixe a IA pontuar e escrever as mensagens. Eles aparecem aqui."
          action={<Link to="/mapeamento" className="btn-primary">Ir para Mapeamento</Link>}
        />
      ) : (
        leads.map((lead) => (
          <CardLead key={lead.id} lead={lead} busy={busy === lead.id} onAprovar={aprovar} onDescartar={descartar} />
        ))
      )}
    </div>
  );
}

function CardLead({
  lead,
  busy,
  onAprovar,
  onDescartar,
}: {
  lead: LeadComMensagem;
  busy: boolean;
  onAprovar: (l: LeadComMensagem) => void;
  onDescartar: (l: LeadComMensagem) => void;
}) {
  const [showWhy, setShowWhy] = useState(false);
  const msg = lead.messages[0];

  return (
    <div className="card card-hover animate-fade-in">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-semibold tracking-tight">{lead.name}</h3>
        <TierBadge tier={lead.niche_tier} />
        <span className="text-sm text-zinc-500">{lead.niche}</span>
        <div className="ml-auto">
          <ScorePill score={lead.score} />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
        <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{lead.phone ?? 'sem telefone'}</span>
        <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5" />{lead.rating ?? '—'} · {lead.num_reviews ?? 0} aval.</span>
        {lead.has_instagram && <span className="inline-flex items-center gap-1"><Instagram className="h-3.5 w-3.5" />Instagram</span>}
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-black/20 p-4">
        <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">{msg?.text ?? '(sem mensagem)'}</p>
      </div>

      {msg?.justification && (
        <div className="mt-3">
          <button
            onClick={() => setShowWhy((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-400 transition hover:text-brand-300"
          >
            <Brain className="h-3.5 w-3.5" />
            Por que essa mensagem?
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showWhy && 'rotate-180')} />
          </button>
          {showWhy && (
            <div className="mt-2 animate-fade-in rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs leading-relaxed text-zinc-400">
              {msg.justification}
              {lead.reasoning_score && (
                <p className="mt-2 border-t border-white/[0.06] pt-2">
                  <span className="font-semibold text-zinc-300">Nota:</span> {lead.reasoning_score}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button onClick={() => onAprovar(lead)} disabled={busy} className="btn-success disabled:opacity-50">
          {busy ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          Aprovar e enviar
        </button>
        <button onClick={() => onDescartar(lead)} className="btn-ghost">
          <X className="h-4 w-4" /> Descartar
        </button>
      </div>
    </div>
  );
}
