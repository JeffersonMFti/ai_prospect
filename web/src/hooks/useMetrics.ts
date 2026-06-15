import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { LeadStatus } from '../lib/types';

export interface Metrics {
  garimpados: number;
  enviados: number;
  responderam: number;
  fecharam: number;
  prontos: number;
  taxaResposta: number | null;
  taxaFechamento: number | null;
  receita: number;
  porNicho: { niche: string; total: number; fechou: number }[];
}

const PRECO = 797;

/** Calcula métricas do funil a partir de uma lista de status + nichos. Pura → testável. */
export function computeMetrics(
  rows: { status: LeadStatus; niche: string | null }[],
): Metrics {
  const count = (s: LeadStatus) => rows.filter((r) => r.status === s).length;

  const garimpados = rows.length;
  // "enviados" = leads que chegaram a ser enviados ou além
  const enviadosOuAlem: LeadStatus[] = ['enviado', 'respondeu', 'fechou'];
  const enviados = rows.filter((r) => enviadosOuAlem.includes(r.status)).length;
  const respondeuOuAlem: LeadStatus[] = ['respondeu', 'fechou'];
  const responderam = rows.filter((r) => respondeuOuAlem.includes(r.status)).length;
  const fecharam = count('fechou');

  const byNiche = new Map<string, { total: number; fechou: number }>();
  for (const r of rows) {
    const k = r.niche ?? 'desconhecido';
    const cur = byNiche.get(k) ?? { total: 0, fechou: 0 };
    cur.total += 1;
    if (r.status === 'fechou') cur.fechou += 1;
    byNiche.set(k, cur);
  }

  return {
    garimpados,
    enviados,
    responderam,
    fecharam,
    prontos: count('pronto'),
    taxaResposta: enviados > 0 ? responderam / enviados : null,
    taxaFechamento: enviados > 0 ? fecharam / enviados : null,
    receita: fecharam * PRECO,
    porNicho: [...byNiche.entries()].map(([niche, v]) => ({ niche, ...v })),
  };
}

export function useMetrics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('leads').select('status, niche');
      setMetrics(computeMetrics((data as { status: LeadStatus; niche: string | null }[]) ?? []));
      setLoading(false);
    })();
  }, []);

  return { metrics, loading };
}
