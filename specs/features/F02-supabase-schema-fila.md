# F02 — Supabase: Schema, RLS, Fila & Cron (FUNDAÇÃO)

## Objetivo
Criar a fundação de dados e infraestrutura no Supabase: todas as tabelas, enums, índices, RLS, `settings` inicial, e os agendamentos pg_cron. É a tarefa **T0** — bloqueia todas as outras.

## Escopo
**DENTRO:** migration `0001_init.sql` com enums, tabelas (`scrape_jobs`, `leads`, `messages`, `sends`, `settings`), índices, triggers `updated_at`, RLS policies, Realtime na `scrape_jobs`, e os jobs pg_cron (apontando para as Edge Functions). Geração de tipos TS.
**FORA:** lógica das Edge Functions (F03/F04), scraper (F01), UI (F05).

## Dependências
- Nenhuma (é a fundação). Define os contratos C1, C3, C5 consumidos por todos.

## Comportamento detalhado
- **RN-01:** criar enums conforme [02-data-model.md](../02-data-model.md).
- **RN-02:** criar tabelas com todas as colunas, defaults, FKs e índices listados em 02.
- **RN-03:** `unique(phone)` em `leads` (dedupe). `unique` lógico de singleton em `settings` (check id=1).
- **RN-04:** trigger `set_updated_at` em `leads` (e onde houver `updated_at`).
- **RN-05 (RLS):** habilitar RLS em todas as tabelas. Policies:
  - `anon`: select em todas; insert em `scrape_jobs`; update restrito em `messages(approved)` e `leads(status)`.
  - `service_role`: bypass natural.
- **RN-06 (Realtime):** adicionar `scrape_jobs` à publication `supabase_realtime`.
- **RN-07 (settings seed):** inserir linha única default (`send_interval_minutes=3`, `daily_send_limit=6`, `price_text='R$ 797 à vista ou 10x sem juros'`).
- **RN-08 (pg_cron):** habilitar extensão `pg_cron` + `pg_net`; agendar `process-send-queue` (1 min) e `score-and-generate` (5 min) chamando as Edge Functions via `pg_net`/http com o secret apropriado.

## Interface / Contrato (define, não consome)
- **C1** — tipos de domínio (gerados via `supabase gen types typescript`).
- **C3** — schema exato das tabelas (esta migration É a fonte).
- **C5** — protocolo de fila documentado em 03-api-contracts §Agente local.

## Critérios de aceitação
- AC1: `supabase db push` aplica a migration do zero sem erro.
- AC2: Todas as tabelas existem com as colunas/índices de 02-data-model.
- AC3: RLS está habilitado em todas; um cliente `anon` consegue `insert` em `scrape_jobs` mas **não** em `leads`.
- AC4: `scrape_jobs` emite eventos Realtime em UPDATE.
- AC5: `settings` tem exatamente 1 linha após a migration.
- AC6: Os 2 jobs pg_cron aparecem em `cron.job`.

## Testes obrigatórios
- SQL: aplicar migration em banco limpo e rodar asserts de existência de tabelas/policies.
- Teste de policy: `anon` insert em `leads` deve falhar; em `scrape_jobs` deve passar.

## Riscos / notas
- `pg_net` + invocação de Edge Function por cron exige a URL do projeto + service key como secret no DB — documentar no README como configurar.
- Manter a migration idempotente onde possível (`create type if not exists` via `do $$`).
