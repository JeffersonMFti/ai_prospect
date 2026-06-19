-- ============================================================================
-- ai_prospect — Migration 0002: pg_cron + pg_net (agendamento das Edge Functions)
--
-- ⚠️ APLIQUE ESTA MIGRATION DEPOIS de:
--    1) ter feito deploy das Edge Functions (T2/T3): score-leads, generate-messages,
--       enqueue-sends, process-send-queue;
--    2) ter guardado os secrets no Vault (project_url e service_role_key).
--
-- Setup dos secrets (rode 1x no SQL Editor, substituindo os valores):
--   select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
--   select vault.create_secret('SEU_SERVICE_ROLE_KEY', 'service_role_key');
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Helper: invoca uma Edge Function via pg_net usando secrets do Vault
create or replace function invoke_edge_function(fn text, body jsonb default '{}'::jsonb)
returns void language plpgsql security definer as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';

  perform net.http_post(
    url     := v_url || '/functions/v1/' || fn,
    headers := jsonb_build_object(
                 'Content-Type','application/json',
                 'Authorization','Bearer ' || v_key),
    body    := body
  );
end $$;

-- Limpa agendamentos antigos (idempotência)
do $$ begin
  perform cron.unschedule('process-send-queue');
exception when others then null; end $$;
do $$ begin
  perform cron.unschedule('score-and-generate');
exception when others then null; end $$;

-- A cada 1 min: processa a fila de envio (dispara no máx. 1, respeitando o gap de 3 min)
select cron.schedule('process-send-queue', '* * * * *', $$
  select invoke_edge_function('process-send-queue');
$$);

-- A cada 5 min: pontua leads 'novo' e gera mensagens para os 6 do dia
select cron.schedule('score-and-generate', '*/5 * * * *', $$
  select invoke_edge_function('score-leads');
  select invoke_edge_function('generate-messages');
$$);
