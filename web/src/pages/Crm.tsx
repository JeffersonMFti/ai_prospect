import { useEffect, useMemo, useState } from 'react';
import {
  KanbanSquare, Phone, MapPin, Star, Instagram, ExternalLink,
  MessageSquare, StickyNote, ChevronDown, Copy, Check, Plus, X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Lead, LeadStatus, Message } from '../lib/types';
import { PageHeader, Spinner, Select, cn } from '../components/ui';
import { LpPromptButton } from '../components/LpPromptButton';

type LeadCard = Lead & { messages: Pick<Message, 'text'>[] };

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'novo', label: '🆕 Novo' },
  { value: 'pontuado', label: '📊 Pontuado' },
  { value: 'pronto', label: '💬 Pronto' },
  { value: 'aprovado', label: '👍 Aprovado' },
  { value: 'enviado', label: '📤 Enviado' },
  { value: 'respondeu', label: '🔥 Respondeu' },
  { value: 'fechou', label: '✅ Fechou' },
  { value: 'descartado', label: '🗑️ Descartado' },
  { value: 'nao_perturbe', label: '🚫 Não perturbe' },
];

interface Column {
  key: string;
  label: string;
  statuses: LeadStatus[];
  drop: LeadStatus;
  head: string; // classes do cabeçalho
  dot: string;
}

const COLUMNS: Column[] = [
  { key: 'novos', label: 'Novos', statuses: ['novo', 'pontuado'], drop: 'pontuado', head: 'text-sky-300', dot: 'bg-sky-400' },
  { key: 'prontos', label: 'Prontos', statuses: ['pronto', 'aprovado'], drop: 'pronto', head: 'text-violet-300', dot: 'bg-violet-400' },
  { key: 'enviados', label: 'Enviados', statuses: ['enviado'], drop: 'enviado', head: 'text-amber-300', dot: 'bg-amber-400' },
  { key: 'responderam', label: 'Responderam', statuses: ['respondeu'], drop: 'respondeu', head: 'text-rose-300', dot: 'bg-rose-400' },
  { key: 'fechados', label: 'Fechados', statuses: ['fechou'], drop: 'fechou', head: 'text-emerald-300', dot: 'bg-emerald-400' },
  { key: 'descartados', label: 'Descartados', statuses: ['descartado', 'nao_perturbe'], drop: 'descartado', head: 'text-zinc-400', dot: 'bg-zinc-500' },
];

export default function Crm() {
  const [leads, setLeads] = useState<LeadCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [over, setOver] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function load() {
    const { data } = await supabase
      .from('leads')
      .select('*, messages(text)')
      .order('score', { ascending: false })
      .limit(500);
    setLeads((data as LeadCard[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const byColumn = useMemo(() => {
    const map: Record<string, LeadCard[]> = {};
    for (const col of COLUMNS) map[col.key] = [];
    for (const l of leads) {
      const col = COLUMNS.find((c) => c.statuses.includes(l.status));
      if (col) map[col.key].push(l);
    }
    return map;
  }, [leads]);

  async function move(leadId: string, status: LeadStatus) {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status } : l)));
    setOver(null);
    await supabase.from('leads').update({ status }).eq('id', leadId);
  }

  async function saveNotes(leadId: string, notes: string) {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, notes } : l)));
    await supabase.from('leads').update({ notes }).eq('id', leadId);
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          icon={KanbanSquare}
          title="CRM"
          subtitle="Arraste (ou use o seletor) conforme conversa · o Dashboard atualiza sozinho"
        />
        <button onClick={() => setAdding(true)} className="btn-ghost mb-6">
          <Plus className="h-4 w-4" /> Lead manual
        </button>
      </div>

      {adding && <AddLeadModal onClose={() => setAdding(false)} onAdded={load} />}

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(col.key);
              }}
              onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
              onDrop={(e) => {
                const id = e.dataTransfer.getData('text/lead');
                if (id) move(id, col.drop);
              }}
              className={cn(
                'flex w-80 shrink-0 flex-col rounded-2xl border p-3 transition-colors',
                over === col.key
                  ? 'border-violet-500/40 bg-violet-500/[0.04]'
                  : 'border-white/[0.06] bg-white/[0.015]',
              )}
            >
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={cn('h-2 w-2 rounded-full', col.dot)} />
                <span className={cn('text-sm font-semibold', col.head)}>{col.label}</span>
                <span className="ml-auto rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-zinc-400">
                  {byColumn[col.key].length}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2.5">
                {byColumn[col.key].length === 0 ? (
                  <p className="px-1 py-6 text-center text-xs text-zinc-600">Arraste cards para cá</p>
                ) : (
                  byColumn[col.key].map((lead) => (
                    <CardCrm key={lead.id} lead={lead} onNotes={saveNotes} onStatus={move} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CardCrm({
  lead,
  onNotes,
  onStatus,
}: {
  lead: LeadCard;
  onNotes: (id: string, notes: string) => void;
  onStatus: (id: string, status: LeadStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notes, setNotes] = useState(lead.notes ?? '');
  const score = lead.score ?? 0;
  const scoreColor = score >= 80 ? 'bg-rose-400' : score >= 55 ? 'bg-amber-400' : 'bg-sky-400';
  const msgText = lead.messages?.[0]?.text ?? '';
  const waUrl = lead.phone
    ? `https://wa.me/${lead.phone}${msgText ? `?text=${encodeURIComponent(msgText)}` : ''}`
    : null;
  const region = lead.address ?? lead.category_maps ?? '';

  function copyMsg(e: React.MouseEvent) {
    e.stopPropagation();
    if (!msgText) return;
    navigator.clipboard.writeText(msgText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/lead', lead.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className="group cursor-grab rounded-xl border border-white/[0.07] bg-[#0d0d12] p-3 shadow-card transition-all hover:border-white/[0.14] active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold leading-tight text-zinc-100">{lead.name}</h4>
        <span className="shrink-0 text-xs font-bold text-zinc-300">{score}%</span>
      </div>

      {/* barra de conversão estimada */}
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={cn('h-full rounded-full transition-all', scoreColor)} style={{ width: `${score}%` }} />
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {lead.niche && (
          <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[11px] text-zinc-400">{lead.niche}</span>
        )}
        {lead.num_reviews != null && (
          <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[11px] text-zinc-400">
            <Star className="h-3 w-3" />
            {lead.rating ?? '—'} · {lead.num_reviews}
          </span>
        )}
      </div>

      {region && (
        <p className="mt-2 flex items-start gap-1 text-[11px] leading-snug text-zinc-500">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="line-clamp-2">{region}</span>
        </p>
      )}

      <div className="mt-2.5 flex items-center gap-1.5">
        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600/90 px-2 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600"
          >
            <Phone className="h-3.5 w-3.5" /> WhatsApp
          </a>
        )}
        {msgText && (
          <button onClick={copyMsg} className="btn-ghost px-2 py-1.5" title="Copiar mensagem">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        )}
        {lead.instagram_url && (
          <a href={lead.instagram_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="btn-ghost px-2 py-1.5" title="Instagram">
            <Instagram className="h-3.5 w-3.5" />
          </a>
        )}
        {lead.maps_url && (
          <a href={lead.maps_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="btn-ghost px-2 py-1.5" title="Ver no Maps">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <LpPromptButton lead={lead} compact />
      </div>

      {/* mover de etapa por dropdown (alternativa ao arrastar) */}
      <div className="mt-2">
        <Select value={lead.status} onChange={(v) => onStatus(lead.id, v)} options={STATUS_OPTIONS} />
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-2 inline-flex items-center gap-1 text-[11px] text-zinc-500 transition hover:text-zinc-300"
      >
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
        detalhes & anotações
      </button>

      {open && (
        <div className="mt-2 animate-fade-in space-y-2">
          {lead.messages?.[0]?.text && (
            <div className="flex items-start gap-1.5 rounded-lg border border-white/[0.06] bg-black/20 p-2 text-[11px] leading-snug text-zinc-400">
              <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-violet-400" />
              <span className="line-clamp-4">{lead.messages[0].text}</span>
            </div>
          )}
          <div>
            <label className="mb-1 flex items-center gap-1 text-[11px] text-zinc-500">
              <StickyNote className="h-3 w-3" /> Anotações
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== (lead.notes ?? '') && onNotes(lead.id, notes)}
              placeholder="O que você conversou, próximos passos…"
              rows={3}
              className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.03] p-2 text-xs text-zinc-200 outline-none focus:border-violet-500/50"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function normalizePhoneBR(raw: string): string | null {
  const d = raw.replace(/\D/g, '');
  if (!d) return null;
  const local = d.startsWith('55') && d.length >= 12 ? d.slice(2) : d;
  if (local.length !== 10 && local.length !== 11) return null;
  return '55' + local;
}

function AddLeadModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [niche, setNiche] = useState('');
  const [status, setStatus] = useState<LeadStatus>('respondeu');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function salvar() {
    if (!name.trim()) return setError('Informe o nome.');
    const normalized = phone.trim() ? normalizePhoneBR(phone) : null;
    if (phone.trim() && !normalized) return setError('Telefone inválido (use DDD + número).');
    setSaving(true);
    setError(null);
    const { error: e } = await supabase.from('leads').insert({
      name: name.trim(),
      phone: normalized,
      niche: niche.trim() || null,
      status,
      notes: notes.trim() || null,
      has_website: false,
      has_instagram: false,
    });
    setSaving(false);
    if (e) return setError(e.message);
    onAdded();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-md animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">Adicionar lead manual</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X className="h-4 w-4" /></button>
        </div>

        {error && <div className="mb-3 rounded-lg border border-rose-500/20 bg-rose-500/[0.06] p-2 text-xs text-rose-300">{error}</div>}

        <div className="space-y-3">
          <Campo label="Nome *"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Okamoto Beauty" /></Campo>
          <Campo label="WhatsApp (DDD + número)"><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="85 99999-9999" /></Campo>
          <Campo label="Nicho"><input className="input" value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="estética" /></Campo>
          <Campo label="Etapa"><Select value={status} onChange={setStatus} options={STATUS_OPTIONS} /></Campo>
          <Campo label="Anotações">
            <textarea
              className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-sm text-zinc-200 outline-none focus:border-violet-500/50"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Onde encontrou, o que conversou…"
            />
          </Campo>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button onClick={salvar} disabled={saving} className="btn-primary">
            {saving ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />} Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-zinc-400">{label}</span>
      {children}
    </label>
  );
}
