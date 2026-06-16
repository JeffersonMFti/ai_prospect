-- ============================================================================
-- ai_prospect — Migration 0003: CRM (anotações por lead)
-- Aplique no SQL Editor: https://supabase.com/dashboard/project/jecpyknyjwzedosjgaqc/sql/new
-- ============================================================================

-- Anotações manuais do CRM (o que você conversou com o lead)
alter table leads add column if not exists notes text;

-- anon pode atualizar notes (além de status) — para o CRM funcionar com a chave pública
revoke update on leads from anon;
grant  update (status, notes) on leads to anon;
