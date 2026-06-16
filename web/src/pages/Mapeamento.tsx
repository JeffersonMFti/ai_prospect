import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Map, Rocket, Sparkles, AlertTriangle, ArrowRight, RotateCcw } from 'lucide-react';
import { useScrapeJob } from '../hooks/useScrapeJob';
import { PageHeader, Spinner } from '../components/ui';
import type { ScrapeJob } from '../lib/types';

export default function Mapeamento() {
  const { job, error, creating, startMapping, reset } = useScrapeJob();
  const [niche, setNiche] = useState('estética');
  const [city, setCity] = useState('Fortaleza - CE');
  const [target, setTarget] = useState(50);
  const [pendingTooLong, setPendingTooLong] = useState(false);

  useEffect(() => {
    if (job?.status !== 'pending') {
      setPendingTooLong(false);
      return;
    }
    const t = setTimeout(() => setPendingTooLong(true), 30_000);
    return () => clearTimeout(t);
  }, [job?.status]);

  const isRunning = job && (job.status === 'pending' || job.status === 'running');

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        icon={Map}
        title="Mapeamento de empresas"
        subtitle="Garimpa empresas sem site no Google Maps · o agente local precisa estar ligado"
      />

      {!isRunning && (
        <div className="card grid gap-4 sm:grid-cols-3">
          <Field label="Nicho">
            <input className="input" value={niche} onChange={(e) => setNiche(e.target.value)} />
          </Field>
          <Field label="Cidade / Região">
            <input className="input" value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <Field label="Meta de empresas">
            <input
              type="number"
              className="input"
              value={target}
              min={1}
              max={200}
              onChange={(e) => setTarget(Number(e.target.value))}
            />
          </Field>
          <div className="sm:col-span-3">
            <button
              className="btn-primary w-full sm:w-auto"
              disabled={creating || !niche || !city}
              onClick={() => startMapping({ niche, city, target_count: target })}
            >
              {creating ? <Spinner className="h-4 w-4" /> : <Rocket className="h-4 w-4" />}
              {creating ? 'Criando…' : 'Começar Mapeamento'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] p-4 text-sm text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {job && <ProgressCard job={job} pendingTooLong={pendingTooLong} onReset={reset} />}
    </div>
  );
}

function ProgressCard({
  job,
  pendingTooLong,
  onReset,
}: {
  job: ScrapeJob;
  pendingTooLong: boolean;
  onReset: () => void;
}) {
  const pct = job.target_count ? Math.min(100, Math.round((job.found_count / job.target_count) * 100)) : 0;

  return (
    <div className="card animate-fade-in text-center">
      {job.status === 'pending' && (
        <div className="py-6">
          <Spinner className="mx-auto h-9 w-9" />
          <p className="mt-4 text-zinc-300">Aguardando o agente local pegar o trabalho…</p>
          {pendingTooLong && (
            <p className="mt-2 flex items-center justify-center gap-2 text-sm text-amber-400">
              <AlertTriangle className="h-4 w-4" />O agente local está ligado? (rode <code className="font-mono">python main.py</code>)
            </p>
          )}
        </div>
      )}

      {job.status === 'running' && (
        <div className="py-4">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-300 ring-1 ring-brand-500/20">
            <Sparkles className="h-3.5 w-3.5 animate-pulse-glow" /> Mapeando ao vivo
          </div>
          <p className="bg-gradient-to-b from-white to-brand-300 bg-clip-text text-7xl font-extrabold tracking-tight text-transparent">
            {job.found_count}
          </p>
          <p className="mt-1 text-sm text-zinc-500">de {job.target_count} empresas captadas</p>
          <div className="mx-auto mt-5 h-2 max-w-sm overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {job.status === 'done' && (
        <div className="py-6">
          <p className="bg-gradient-to-b from-emerald-200 to-emerald-500 bg-clip-text text-6xl font-extrabold text-transparent">
            {job.found_count}
          </p>
          <p className="mt-2 text-zinc-300">empresas captadas! 🎉</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/aprovacao" className="btn-primary">
              Ver leads <ArrowRight className="h-4 w-4" />
            </Link>
            <button onClick={onReset} className="btn-ghost">
              <RotateCcw className="h-4 w-4" /> Novo mapeamento
            </button>
          </div>
        </div>
      )}

      {job.status === 'error' && (
        <div className="py-6">
          <AlertTriangle className="mx-auto h-8 w-8 text-rose-400" />
          <p className="mt-3 text-rose-300">{job.error_message ?? 'Erro no mapeamento.'}</p>
          <button onClick={onReset} className="btn-ghost mt-5">
            <RotateCcw className="h-4 w-4" /> Tentar de novo
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-zinc-400">{label}</span>
      {children}
    </label>
  );
}
