-- ============================================================================
-- ai_prospect — Migration 0005: adicionar lead manual pelo dashboard
-- Aplique no SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT_REF/sql/new
-- ============================================================================

-- Permite o dashboard (anon) inserir leads prospectados manualmente (ex.: Instagram)
drop policy if exists anon_insert_leads on leads;
create policy anon_insert_leads on leads for insert to anon with check (true);

grant insert (
  name, phone, niche, niche_tier, status, notes, address,
  has_instagram, instagram_url, score, reasoning_score
) on leads to anon;
