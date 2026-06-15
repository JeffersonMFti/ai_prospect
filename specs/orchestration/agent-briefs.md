# Orchestration — Agent Briefs

> Brief pronto para colar ao iniciar cada tarefa (no Claude Code do VSCode, uma tarefa por vez ou via sub-agentes).
> Formato de relatório de encerramento no fim deste arquivo.

---

## BRIEF — T0: Fundação Supabase (F02)

**Você é** um agente de implementação. Construa SOMENTE a fundação de dados.
**Leitura obrigatória:** `specs/CONSTITUTION.md` → `specs/02-data-model.md` → `specs/features/F02-supabase-schema-fila.md` → `specs/orchestration/interface-contracts.md` (C1, C3, C5, C6).
**Escopo de escrita:** `supabase/migrations/0001_init.sql`, `supabase/config.toml`, `web/src/lib/types.ts` (tipos base gerados).
**Contratos a honrar:** define C1/C3/C5 — congele-os exatamente como nas specs.
**Entregáveis:** migration completa (enums, tabelas, índices, triggers, RLS, Realtime, settings seed, pg_cron), config, tipos TS gerados, testes SQL de policy.
**DoD:** Constitution §5 + ACs de F02. Documentar no `.env.example` os secrets do cron (C6).

---

## BRIEF — T1: Agente local + Scraper (F01)

**Você é** um agente de implementação. Construa SOMENTE o agente local Python.
**Leitura obrigatória:** `CONSTITUTION.md` → `F01-scraper-agente-local.md` → `03-api-contracts.md` (§Agente local) → `interface-contracts.md` (C1, C3, C5, C6).
**Escopo de escrita:** `agent/**`.
**Contratos a honrar:** C5 (protocolo de fila), C3 (schema `scrape_jobs`/`leads`), C1. NÃO alterar schema.
**Entregáveis:** `main.py` (loop poll+claim), `scraper/maps_scraper.py` (Playwright headful+stealth), `human_behavior.py`, `parsers.py`, `supabase_client.py`, `config.py`, `pyproject.toml`, `.env.example`, testes pytest (telefone, parser, behavior).
**DoD:** Constitution §5 + ACs de F01. Navegador **NÃO headless**.

---

## BRIEF — T2: Edge Functions de IA (F03)

**Você é** um agente de implementação. Construa SOMENTE as EFs de scoring e mensagens.
**Leitura obrigatória:** `CONSTITUTION.md` → `F03-ia-scoring-mensagens.md` → `04-ai-prompts.md` → `03-api-contracts.md` (EF-1, EF-2) → `interface-contracts.md` (C1, C2, C3, C6).
**Escopo de escrita:** `supabase/functions/score-leads/`, `generate-messages/`, `_shared/gemini.ts`, `_shared/types.ts`, `_shared/cors.ts`.
**Contratos a honrar:** implementa C2 (EF-1/EF-2); consolida C1 em `_shared/types.ts`. NÃO alterar schema (C3).
**Entregáveis:** as 2 EFs, wrapper Gemini com retry+Zod, prompts de 04, testes unit (prompt builder, parser, seleção dos 6). Gemini só via secret.
**DoD:** Constitution §5 + ACs de F03.

---

## BRIEF — T3: Edge Functions de Envio (F04)

**Você é** um agente de implementação. Construa SOMENTE aprovação + envio com throttle.
**Leitura obrigatória:** `CONSTITUTION.md` → `F04-aprovacao-envio-throttle.md` → `03-api-contracts.md` (EF-3, EF-4, §uazapi) → `interface-contracts.md` (C2, C3, C4, C6). Use a skill `uazapi-whatsapp`.
**Escopo de escrita:** `supabase/functions/enqueue-sends/`, `process-send-queue/`, `_shared/uazapi.ts`.
**Contratos a honrar:** implementa C2 (EF-3/EF-4), C4 (uazapi). Lê `_shared/types.ts` (de T2) — não recriar.
**Entregáveis:** as 2 EFs, wrapper uazapi, lógica RN-SEND-01 (agendamento espaçado) e cooldown 3 min, testes unit (scheduled_at, cooldown, payload, limite diário).
**DoD:** Constitution §5 + ACs de F04. Throttle por banco (sem sleep).

---

## BRIEF — T4: Dashboard Web (F05)

**Você é** um agente de implementação. Construa SOMENTE o dashboard React.
**Leitura obrigatória:** `CONSTITUTION.md` → `F05-dashboard-web.md` → `03-api-contracts.md` (C1, EF-3, Realtime) → `interface-contracts.md` (C1, C2, C6).
**Escopo de escrita:** `web/**` (exceto `src/lib/types.ts` base, que vem de T0 — pode estender espelhando C1).
**Contratos a honrar:** C1 (tipos), C2 (chama EF-3), C5 (assina Realtime de `scrape_jobs`). Só `anon` key. Nunca chamar Gemini/uazapi do front.
**Entregáveis:** app Vite+TS+Tailwind+shadcn, client Supabase, telas Mapeamento/Aprovação/Fila/Dashboard, hooks, gráficos Recharts, testes (hook de métricas, card de aprovação, contador realtime).
**DoD:** Constitution §5 + ACs de F05.

---

## BRIEF — T5: Integração & Verificação Final

**Você é** o orquestrador integrando tudo.
**Leitura:** todas as specs + relatórios das tarefas.
**Escopo:** testes de integração, `.env.example` raiz consolidado, README final, smoke test ponta-a-ponta.
**Entregáveis:** Fluxo A→B→C validado com 1–2 leads reais; checklist da Fase 5 da skill de orquestração verde; docs atualizadas.

---

## Relatório de Encerramento (formato obrigatório)

```
- Tarefa/Branch: T<N> / feat/<x>   | Commits: <n>
- Arquivos criados/alterados: <lista>
- Critérios de aceitação: AC1 ✅ / AC2 ✅ / ACn ⚠️ (motivo)
- DoD: typecheck ✅ lint ✅ testes ✅ build ✅  (ou ❌ + log)
- SPEC-GAPs encontrados: <ambiguidade + interpretação adotada>
- Suposições feitas: <lista>
- Pendências / não feito e por quê: <lista>
- Precisa de algo do orquestrador? <sim/não — o quê>
```
