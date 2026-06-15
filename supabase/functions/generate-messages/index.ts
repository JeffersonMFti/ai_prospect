// EF-2 generate-messages — escreve mensagem + justificativa p/ os melhores leads do dia. Spec: F03.
import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase.ts';
import { callGeminiJSON } from '../_shared/gemini.ts';
import { MESSAGE_SYSTEM, buildMessageUserPrompt } from '../_shared/prompts.ts';
import type { LeadRow, MessageResult } from '../_shared/types.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { limit } = await req.json().catch(() => ({}));
    const db = adminClient();

    // settings (limite diário, assinatura, preço, cidade default)
    const { data: settings } = await db.from('settings').select('*').eq('id', 1).single();
    const dailyLimit = limit ?? settings?.daily_send_limit ?? 6;

    // melhores leads 'pontuado' por score; exclui quem já tem mensagem
    const { data: leads, error } = await db
      .from('leads')
      .select('*, messages(id)')
      .eq('status', 'pontuado')
      .order('score', { ascending: false })
      .limit(dailyLimit * 3);
    if (error) return json({ error: error.message }, 500);

    const pendentes = (leads ?? [])
      .filter((l: { messages?: unknown[] }) => !l.messages || l.messages.length === 0)
      .slice(0, dailyLimit) as (LeadRow & { messages?: unknown[] })[];

    if (!pendentes.length) return json({ generated: 0 });

    const parsed = await callGeminiJSON<{ results: MessageResult[] }>({
      systemPrompt: MESSAGE_SYSTEM,
      userPrompt: buildMessageUserPrompt(
        pendentes,
        settings?.default_city ?? '',
        settings?.message_signature ?? '',
        settings?.price_text ?? 'R$ 797 à vista ou 10x sem juros',
      ),
    });

    let generated = 0;
    for (const r of parsed.results ?? []) {
      if (!r.lead_id || !r.message?.trim()) continue;
      const { error: insErr } = await db.from('messages').insert({
        lead_id: r.lead_id,
        text: r.message.trim(),
        justification: (r.justification ?? '').trim(),
        model_used: 'gemini-2.5-flash',
      });
      if (insErr) continue;
      await db.from('leads').update({ status: 'pronto' }).eq('id', r.lead_id).eq('status', 'pontuado');
      generated++;
    }

    return json({ generated });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
