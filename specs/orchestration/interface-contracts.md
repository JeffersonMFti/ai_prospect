# Orchestration — Contratos de Interface (CONGELADOS)

> Fronteiras compartilhadas. **Nenhum agente altera um contrato sozinho.** Contrato furado → PARE e reporte ao orquestrador.

## C1 — Tipos de domínio compartilhados
**Provedor:** T0 (gera tipos do banco) + T2 (consolida em `_shared/types.ts` e espelha em `web/src/lib/types.ts`).
**Consumidores:** T1, T2, T3, T4.

Definição canônica em [03-api-contracts.md §Tipos compartilhados](../03-api-contracts.md). Resumo das entidades:
`Lead`, `Message`, `ScrapeJob`, `Send`, e enums `LeadStatus`, `NicheTier`, `JobStatus`, `SendStatus`.
Regra: o front e as EFs usam exatamente esses nomes/campos. Mudança de campo = novo contrato aprovado.

## C2 — Contratos das Edge Functions
**Provedor:** T2 (EF-1, EF-2), T3 (EF-3, EF-4). **Consumidor:** T4 (front chama EF-3) + cron (chama EF-1,2,4).

Assinaturas exatas (input/output/erros) em [03-api-contracts.md](../03-api-contracts.md):
- `EF-1 score-leads` — body `{lead_ids?, limit?}` → `{scored:number}`.
- `EF-2 generate-messages` — body `{limit?}` → `{generated:number}`.
- `EF-3 enqueue-sends` — body `{message_ids:string[]}` → `{enqueued, first_at, last_at}`.
- `EF-4 process-send-queue` — sem body → `{sent:0|1, reason?}`.

## C3 — Schema do banco
**Provedor:** T0 (migration `0001_init.sql`). **Consumidor:** todos.
Fonte: [02-data-model.md](../02-data-model.md). Tabelas/colunas/índices/enums/RLS exatamente como descrito.
Mudança de schema = nova migration aprovada pelo orquestrador (nunca alterar a 0001 após congelar).

## C4 — Contrato uazapi (envio de texto)
**Provedor:** T3 (`_shared/uazapi.ts`). **Consumidor:** EF-4.
```
sendText(phone: string /*E.164 sem +*/, text: string): Promise<UazapiResponse>
POST {UAZAPI_BASE_URL}/send/text  headers: { token: UAZAPI_TOKEN }  body: { number, text }
```
Detalhes na skill `uazapi-whatsapp`. Telefone validado antes do envio.

## C5 — Protocolo da fila de mapeamento (agente local ↔ Supabase)
**Provedor:** T0 (tabela + Realtime). **Consumidores:** T1 (agente escreve), T4 (front lê via Realtime).
Fonte: [03-api-contracts.md §Agente local](../03-api-contracts.md). Pontos congelados:
- Claim atômico: `update scrape_jobs set status='running' where id=? and status='pending'`.
- Progresso: incrementar `found_count` por lead inserido.
- Dedupe: `insert into leads ... on conflict (phone) do nothing`.
- Realtime: front assina `UPDATE` em `scrape_jobs` filtrado por id.

## C6 — Variáveis de ambiente (nomes congelados)
**Consumidores:** todos. Documentar valores no `.env.example` de cada pasta.
```
# agent/.env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=            # opcional (queries/limpeza)
POLL_INTERVAL_SECONDS=5

# supabase (secrets)
GEMINI_API_KEY=
UAZAPI_BASE_URL=
UAZAPI_TOKEN=
PROJECT_URL=               # p/ pg_cron invocar EFs
SERVICE_ROLE_KEY=          # p/ pg_cron

# web/.env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```
