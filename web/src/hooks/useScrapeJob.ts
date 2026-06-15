import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ScrapeJob } from '../lib/types';

/**
 * Cria um job de mapeamento e acompanha o progresso ao vivo via Supabase Realtime.
 * O agente local (Python) consome o job e incrementa found_count — aqui só ouvimos.
 */
export function useScrapeJob() {
  const [job, setJob] = useState<ScrapeJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Limpa a subscription ao desmontar
  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  function subscribe(jobId: string) {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = supabase
      .channel(`scrape_job_${jobId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'scrape_jobs', filter: `id=eq.${jobId}` },
        (payload) => setJob(payload.new as ScrapeJob),
      )
      .subscribe();
  }

  async function startMapping(input: { niche: string; city: string; target_count: number }) {
    setCreating(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from('scrape_jobs')
      .insert({ niche: input.niche, city: input.city, target_count: input.target_count })
      .select()
      .single();
    setCreating(false);

    if (insertError || !data) {
      setError(insertError?.message ?? 'Falha ao criar o job de mapeamento.');
      return;
    }
    setJob(data as ScrapeJob);
    subscribe((data as ScrapeJob).id);
  }

  function reset() {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = null;
    setJob(null);
    setError(null);
  }

  return { job, error, creating, startMapping, reset };
}
