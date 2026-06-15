import { useEffect, useState } from 'react';
import { useScrapeJob } from '../hooks/useScrapeJob';

export default function Mapeamento() {
  const { job, error, creating, startMapping, reset } = useScrapeJob();
  const [niche, setNiche] = useState('estética');
  const [city, setCity] = useState('Fortaleza - CE');
  const [target, setTarget] = useState(50);
  const [pendingTooLong, setPendingTooLong] = useState(false);

  // Aviso "o agente local está ligado?" se ficar pending por >30s
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mapeamento de empresas</h1>
        <p className="text-sm text-zinc-400">
          Garimpa empresas <strong>sem site</strong> no Google Maps. O agente local precisa estar ligado.
        </p>
      </div>

      {!isRunning && (
        <div className="grid gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 sm:grid-cols-3">
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
              className="rounded-lg bg-brand px-5 py-2.5 font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
              disabled={creating || !niche || !city}
              onClick={() => startMapping({ niche, city, target_count: target })}
            >
              {creating ? 'Criando...' : '🚀 Começar Mapeamento'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/50 p-4 text-sm text-red-300">{error}</div>
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
  job: import('../lib/types').ScrapeJob;
  pendingTooLong: boolean;
  onReset: () => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-center">
      {job.status === 'pending' && (
        <>
          <Spinner />
          <p className="mt-3 text-zinc-300">Aguardando o agente local pegar o trabalho…</p>
          {pendingTooLong && (
            <p className="mt-2 text-sm text-amber-400">
              ⚠️ Demorando… o <strong>agente local</strong> está ligado na sua máquina? (rode <code>python main.py</code>)
            </p>
          )}
        </>
      )}

      {job.status === 'running' && (
        <>
          <Spinner />
          <p className="mt-3 text-lg text-zinc-300">🔄 Mapeando…</p>
          <p className="mt-1 text-5xl font-extrabold text-brand">{job.found_count}</p>
          <p className="text-sm text-zinc-500">empresas captadas (meta: {job.target_count})</p>
        </>
      )}

      {job.status === 'done' && (
        <>
          <p className="text-5xl font-extrabold text-emerald-400">✅ {job.found_count}</p>
          <p className="mt-1 text-zinc-300">empresas captadas!</p>
          <div className="mt-4 flex justify-center gap-3">
            <a href="/aprovacao" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
              Ver leads →
            </a>
            <button onClick={onReset} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm">
              Novo mapeamento
            </button>
          </div>
        </>
      )}

      {job.status === 'error' && (
        <>
          <p className="text-2xl">⚠️</p>
          <p className="mt-2 text-red-300">{job.error_message ?? 'Erro no mapeamento.'}</p>
          <button onClick={onReset} className="mt-4 rounded-lg border border-zinc-700 px-4 py-2 text-sm">
            Tentar de novo
          </button>
        </>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-zinc-700 border-t-brand" />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-zinc-400">{label}</span>
      {children}
    </label>
  );
}
