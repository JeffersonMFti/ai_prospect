// EF-4 process-send-queue — dispara no máx. 1 msg/execução, gap de 3 min (F04 RN-02..04).
// Chamada pelo pg_cron a cada 1 min.
import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase.ts';
import { inCooldown } from '../_shared/throttle.ts';
import { isValidPhone, sendText } from '../_shared/uazapi.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const db = adminClient();
    const now = new Date();
    const { data: settings } = await db
      .from('settings')
      .select('send_interval_minutes, daily_send_limit')
      .eq('id', 1)
      .single();
    const intervalMin = settings?.send_interval_minutes ?? 3;
    const dailyLimit = settings?.daily_send_limit ?? 6;

    // 1) cooldown: último enviado há menos de intervalMin?
    const { data: lastSent } = await db
      .from('sends')
      .select('sent_at')
      .eq('status', 'enviado')
      .order('sent_at', { ascending: false })
      .limit(1);
    if (inCooldown(now, lastSent?.[0]?.sent_at ? new Date(lastSent[0].sent_at) : null, intervalMin)) {
      return json({ sent: 0, reason: 'cooldown' });
    }

    // 2) limite diário
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const { count } = await db
      .from('sends')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'enviado')
      .gte('sent_at', startOfDay.toISOString());
    if ((count ?? 0) >= dailyLimit) return json({ sent: 0, reason: 'daily_limit' });

    // 3) próximo agendado vencido
    const { data: queued } = await db
      .from('sends')
      .select('id, lead_id, message_id, leads(status, phone), messages(text)')
      .eq('status', 'agendado')
      .lte('scheduled_at', now.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(1);

    const item = queued?.[0] as
      | {
          id: string;
          lead_id: string;
          message_id: string;
          leads: { status: string; phone: string | null } | { status: string; phone: string | null }[] | null;
          messages: { text: string } | { text: string }[] | null;
        }
      | undefined;
    if (!item) return json({ sent: 0, reason: 'empty' });

    // PostgREST pode retornar embed to-one como objeto OU array — normaliza
    const lead = Array.isArray(item.leads) ? item.leads[0] : item.leads;
    const message = Array.isArray(item.messages) ? item.messages[0] : item.messages;

    // opt-out: lead pediu para não receber -> cancela
    if (lead?.status === 'nao_perturbe') {
      await db.from('sends').update({ status: 'cancelado' }).eq('id', item.id);
      return json({ sent: 0, reason: 'opt_out' });
    }

    const phone = lead?.phone ?? null;
    if (!isValidPhone(phone)) {
      await db.from('sends').update({ status: 'falhou', error_message: 'telefone inválido' }).eq('id', item.id);
      return json({ sent: 0, reason: 'invalid_phone' });
    }

    // 4) dispara
    try {
      const result = await sendText(phone, message?.text ?? '');
      if (result.ok) {
        await db
          .from('sends')
          .update({ status: 'enviado', sent_at: now.toISOString(), uazapi_response: result.body })
          .eq('id', item.id);
        await db.from('leads').update({ status: 'enviado' }).eq('id', item.lead_id);
        return json({ sent: 1 });
      }
      await db
        .from('sends')
        .update({ status: 'falhou', error_message: `uazapi HTTP ${result.status}`, uazapi_response: result.body })
        .eq('id', item.id);
      return json({ sent: 0, reason: 'uazapi_error' });
    } catch (e) {
      await db.from('sends').update({ status: 'falhou', error_message: String(e) }).eq('id', item.id);
      return json({ sent: 0, reason: 'exception' });
    }
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
