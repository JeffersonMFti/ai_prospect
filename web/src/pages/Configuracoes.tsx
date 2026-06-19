import { useEffect, useState } from 'react';
import { Settings2, Save, Check, Clock, Send, Repeat, User, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Settings } from '../lib/types';
import { PageHeader, Spinner } from '../components/ui';

export default function Configuracoes() {
  const [s, setS] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error: e } = await supabase.from('settings').select('*').eq('id', 1).single();
      if (e) setError(e.message);
      setS(data as Settings);
      setLoading(false);
    })();
  }, []);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setS((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  async function save() {
    if (!s) return;
    setSaving(true);
    setError(null);
    const { error: e } = await supabase
      .from('settings')
      .update({
        send_interval_minutes: s.send_interval_minutes,
        daily_send_limit: s.daily_send_limit,
        default_niches: s.default_niches,
        default_city: s.default_city,
        message_signature: s.message_signature,
        price_text: s.price_text,
        business_hours_start: s.business_hours_start,
        business_hours_end: s.business_hours_end,
        follow_up_days: s.follow_up_days,
        max_follow_ups: s.max_follow_ups,
      })
      .eq('id', 1);
    setSaving(false);
    if (e) return setError(e.message);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (!s) return <p className="text-rose-300">{error ?? 'Não foi possível carregar as configurações.'}</p>;

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader icon={Settings2} title="Configurações" subtitle="Controle o ritmo, o tom e as regras da prospecção" />

      {error && <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] p-4 text-sm text-rose-300">{error}</div>}

      <Section icon={Send} title="Envio">
        <Num label="Intervalo entre envios (min)" value={s.send_interval_minutes} min={1} onChange={(v) => set('send_interval_minutes', v)} />
        <Num label="Limite de envios por dia" value={s.daily_send_limit} min={1} onChange={(v) => set('daily_send_limit', v)} />
      </Section>

      <Section icon={Clock} title="Janela de horário comercial">
        <Num label="Início (hora)" value={s.business_hours_start} min={0} max={23} onChange={(v) => set('business_hours_start', v)} />
        <Num label="Fim (hora)" value={s.business_hours_end} min={1} max={24} onChange={(v) => set('business_hours_end', v)} />
        <p className="col-span-2 text-xs text-zinc-500">
          Mensagens só são disparadas entre {s.business_hours_start}h e {s.business_hours_end}h (evita parecer bot e respeita o lead).
        </p>
      </Section>

      <Section icon={Repeat} title="Follow-up">
        <Num label="Reenviar após (dias sem resposta)" value={s.follow_up_days} min={1} onChange={(v) => set('follow_up_days', v)} />
        <Num label="Máximo de follow-ups" value={s.max_follow_ups} min={0} max={5} onChange={(v) => set('max_follow_ups', v)} />
      </Section>

      <Section icon={User} title="Sua identidade & busca">
        <Text label="Cidade padrão (busca)" value={s.default_city ?? ''} onChange={(v) => set('default_city', v)} className="col-span-2" />
        <Text
          label="Nichos padrão (separados por vírgula)"
          value={s.default_niches.join(', ')}
          onChange={(v) => set('default_niches', v.split(',').map((x) => x.trim()).filter(Boolean))}
          className="col-span-2"
        />
        <Text label="Assinatura nas mensagens" value={s.message_signature} onChange={(v) => set('message_signature', v)} className="col-span-2" />
      </Section>

      <Section icon={DollarSign} title="Oferta">
        <Text label="Texto de preço" value={s.price_text} onChange={(v) => set('price_text', v)} className="col-span-2" />
      </Section>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? <Spinner className="h-4 w-4" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? 'Salvo!' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Send; title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-200">
        <Icon className="h-4 w-4 text-brand-400" /> {title}
      </h2>
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Num({
  label, value, onChange, min, max,
}: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-zinc-400">{label}</span>
      <input type="number" className="input" value={value} min={min} max={max} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function Text({
  label, value, onChange, className,
}: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <label className={`block text-sm ${className ?? ''}`}>
      <span className="mb-1.5 block font-medium text-zinc-400">{label}</span>
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
