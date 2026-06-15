// EF-3 enqueue-sends — aprova mensagens e agenda envios espaçados (F04 RN-SEND-01).
import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase.ts';
import { nextSlot } from '../_shared/throttle.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { message_ids } = await req.json().catch(() => ({}));
    if (!Array.isArray(message_ids) || message_ids.length === 0) {
      return json({ error: 'message_ids (array não-vazio) é obrigatório.' }, 400);
    }

    const db = adminClient();
    const { data: settings } = await db.from('settings').select('send_interval_minutes').eq('id', 1).single();
    const intervalMin = settings?.send_interval_minutes ?? 3;

    // maior scheduled_at já agendado (para continuar a régua de 3 min)
    const { data: last } = await db
      .from('sends')
      .select('scheduled_at')
      .eq('status', 'agendado')
      .order('scheduled_at', { ascending: false })
      .limit(1);
    let cursor: Date | null = last?.[0] ? new Date(last[0].scheduled_at) : null;

    const now = new Date();
    let enqueued = 0;
    let firstAt: string | null = null;
    let lastAt: string | null = null;

    for (const messageId of message_ids) {
      const { data: msg } = await db
        .from('messages')
        .select('id, lead_id, approved')
        .eq('id', messageId)
        .single();
      if (!msg || msg.approved) continue; // não existe ou já aprovada (idempotência)

      const slot = nextSlot(now, cursor, intervalMin);
      cursor = slot;

      const { error: insErr } = await db.from('sends').insert({
        lead_id: msg.lead_id,
        message_id: msg.id,
        scheduled_at: slot.toISOString(),
      });
      if (insErr) continue; // uq_sends_message garante 1 por mensagem

      await db.from('messages').update({ approved: true, approved_at: now.toISOString() }).eq('id', msg.id);
      await db.from('leads').update({ status: 'aprovado' }).eq('id', msg.lead_id);

      enqueued++;
      firstAt ??= slot.toISOString();
      lastAt = slot.toISOString();
    }

    return json({ enqueued, first_at: firstAt, last_at: lastAt });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
