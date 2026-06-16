-- ============================================================================
-- ai_prospect — Migration 0004: Configurações editáveis + follow-up
-- Aplique no SQL Editor: https://supabase.com/dashboard/project/jecpyknyjwzedosjgaqc/sql/new
-- ============================================================================

-- settings: janela de horário comercial + parâmetros de follow-up
alter table settings add column if not exists business_hours_start int not null default 9;
alter table settings add column if not exists business_hours_end   int not null default 18;
alter table settings add column if not exists follow_up_days        int not null default 3;
alter table settings add column if not exists max_follow_ups        int not null default 2;

-- leads: rastreio de follow-up (usado pelo sender quando o WhatsApp for ligado)
alter table leads add column if not exists follow_up_count   int not null default 0;
alter table leads add column if not exists last_contact_at   timestamptz;
alter table leads add column if not exists next_follow_up_at timestamptz;

-- anon (dashboard) pode editar as configurações pela tela de Configurações
drop policy if exists anon_update_settings on settings;
create policy anon_update_settings on settings for update to anon using (true) with check (true);
revoke update on settings from anon;
grant update (
  send_interval_minutes, daily_send_limit, default_niches, default_city,
  message_signature, price_text, business_hours_start, business_hours_end,
  follow_up_days, max_follow_ups
) on settings to anon;
