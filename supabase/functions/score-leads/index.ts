// EF-1 score-leads — pontua e classifica leads 'novo' com Gemini. Spec: F03.
import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase.ts';
import { callGeminiJSON } from '../_shared/gemini.ts';
import { SCORING_SYSTEM, buildScoringUserPrompt } from '../_shared/prompts.ts';
import type { LeadRow, NicheTier, ScoreResult } from '../_shared/types.ts';

const TIERS: NicheTier[] = ['quente', 'morno', 'frio'];

function valid(r: ScoreResult): boolean {
  return (
    typeof r.lead_id === 'string' &&
    typeof r.score === 'number' &&
    r.score >= 0 &&
    r.score <= 100 &&
    TIERS.includes(r.niche_tier)
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { lead_ids, limit } = await req.json().catch(() => ({}));
    const db = adminClient();

    let q = db.from('leads').select('*').eq('status', 'novo').limit(limit ?? 50);
    if (Array.isArray(lead_ids) && lead_ids.length) q = q.in('id', lead_ids);
    const { data: leads, error } = await q;
    if (error) return json({ error: error.message }, 500);
    if (!leads?.length) return json({ scored: 0 });

    const parsed = await callGeminiJSON<{ results: ScoreResult[] }>({
      systemPrompt: SCORING_SYSTEM,
      userPrompt: buildScoringUserPrompt(leads as LeadRow[]),
    });

    let scored = 0;
    for (const r of parsed.results ?? []) {
      if (!valid(r)) continue;
      const { error: upErr } = await db
        .from('leads')
        .update({
          score: Math.round(r.score),
          niche: r.niche,
          niche_tier: r.niche_tier,
          reasoning_score: r.reasoning_score,
          status: 'pontuado',
        })
        .eq('id', r.lead_id)
        .eq('status', 'novo');
      if (!upErr) scored++;
    }

    return json({ scored });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
