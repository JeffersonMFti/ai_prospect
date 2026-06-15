# 02 — Modelo de Dados (Supabase / Postgres)

> Fonte única da verdade do schema. As Edge Functions, o agente e o front **consomem** isto.
> Migration de referência: `supabase/migrations/0001_init.sql`.

## Enums

```sql
create type lead_status as enum (
  'novo',         -- recém-raspado, ainda não pontuado
  'pontuado',     -- IA deu nota e classificou
  'pronto',       -- IA gerou mensagem, aguardando aprovação
  'aprovado',     -- usuário aprovou, foi para fila de envio
  'enviado',      -- mensagem disparada
  'respondeu',    -- lead respondeu
  'fechou',       -- virou venda
  'descartado',   -- usuário descartou
  'nao_perturbe'  -- opt-out / pediu para não receber
);

create type job_status as enum ('pending','running','done','error');
create type send_status as enum ('agendado','enviado','falhou','cancelado');
create type niche_tier as enum ('quente','morno','frio'); -- potencial de conversão em LP
```

## Tabela `scrape_jobs` — fila de mapeamento (ponte web ↔ agente local)

| Coluna | Tipo | Default / Regra |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| status | job_status | 'pending' |
| niche | text | nicho buscado (ex.: "estética") |
| city | text | cidade/região (ex.: "Fortaleza - CE") |
| target_count | int | meta de leads (default 50) |
| found_count | int | **incrementado ao vivo pelo agente** (default 0) |
| error_message | text | null |
| created_at | timestamptz | now() |
| started_at | timestamptz | null |
| finished_at | timestamptz | null |

- **Realtime habilitado** nesta tabela (o front assina `found_count`/`status`).
- O agente local seleciona `where status='pending' order by created_at limit 1`, marca `running`, processa, finaliza.

## Tabela `leads`

| Coluna | Tipo | Default / Regra |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| job_id | uuid FK → scrape_jobs | nullable |
| name | text | NOT NULL |
| phone | text | telefone normalizado E.164 (ex.: 5585...) — base do dedupe |
| raw_phone | text | como veio do Maps |
| address | text | |
| category_maps | text | categoria que o Maps mostra |
| niche | text | nicho normalizado pela IA |
| niche_tier | niche_tier | preenchido pela IA |
| rating | numeric(2,1) | nota do Maps (0–5) |
| num_reviews | int | qtd de avaliações |
| has_instagram | bool | usa Instagram como "site" |
| instagram_url | text | |
| maps_url | text | link do perfil no Maps |
| has_website | bool | **deve ser false** (filtro principal) |
| score | int | 0–100, da IA |
| reasoning_score | text | por que recebeu essa nota |
| status | lead_status | 'novo' |
| created_at | timestamptz | now() |
| updated_at | timestamptz | now() (trigger) |

Índices: `unique (phone)` (dedupe), `index (status)`, `index (score desc)`, `index (niche_tier)`, `index (created_at)`.

## Tabela `messages`

| Coluna | Tipo | Default / Regra |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| lead_id | uuid FK → leads | NOT NULL |
| text | text | mensagem de captação gerada |
| justification | text | **log de raciocínio da IA** (por que essa mensagem) |
| model_used | text | ex.: 'gemini-2.5-flash' |
| approved | bool | default false |
| approved_at | timestamptz | null |
| created_at | timestamptz | now() |

Índice: `index (lead_id)`, `index (approved)`.

## Tabela `sends` — fila de envio com throttle

| Coluna | Tipo | Default / Regra |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| lead_id | uuid FK → leads | NOT NULL |
| message_id | uuid FK → messages | NOT NULL |
| scheduled_at | timestamptz | **espaçado de 3 min** entre envios |
| sent_at | timestamptz | null |
| status | send_status | 'agendado' |
| uazapi_response | jsonb | resposta crua do disparo |
| error_message | text | null |
| responded | bool | default false |
| responded_at | timestamptz | null |
| created_at | timestamptz | now() |

Índices: `index (status, scheduled_at)` (o cron busca por isso), `index (lead_id)`.

**Regra de agendamento (RN-SEND-01):** ao aprovar, `scheduled_at = max(now(), maior scheduled_at de sends 'agendado' + 3 min)`.
Garante 1 envio a cada 3 minutos mesmo aprovando vários de uma vez.

## Tabela `settings` — config operacional (linha única)

| Coluna | Tipo | Default |
|---|---|---|
| id | int PK | 1 (check id=1) |
| send_interval_minutes | int | 3 |
| daily_send_limit | int | 6 |
| default_niches | text[] | nichos preferidos |
| default_city | text | |
| message_signature | text | assinatura/CTA padrão |
| price_text | text | 'R$ 797 à vista ou 10x sem juros' |
| updated_at | timestamptz | now() |

## RLS (Row Level Security)

- **Todas** as tabelas com RLS habilitado.
- `anon` (frontend): `select` em todas; `insert` em `scrape_jobs`; `update` em `messages.approved` e `leads.status` (aprovar/descartar). Demais escritas negadas.
- `service_role` (agente local + Edge Functions): acesso total (bypassa RLS por natureza).
- Política mínima de exemplo na migration; refinar em F0x conforme necessidade.

## pg_cron

```sql
-- a cada 1 min: processa a fila de envio (dispara no máx. 1 por execução, respeitando 3 min)
select cron.schedule('process-send-queue', '* * * * *', $$ ... invoca edge function ... $$);

-- a cada 5 min: pontua leads 'novo' e gera mensagens para os 6 do dia
select cron.schedule('score-and-generate', '*/5 * * * *', $$ ... $$);
```
(Detalhe de invocação da Edge Function via `pg_net`/`http` fica na migration.)

## Diagrama de relacionamento

```
scrape_jobs 1───* leads 1───* messages 1───* sends
settings (singleton)
```
