# 03 — Contratos de API (Edge Functions + Realtime)

> Todas as funções rodam em Deno (Supabase Edge Functions). Input validado com **Zod**.
> Erros sempre `{ error: string }` + status HTTP adequado. CORS habilitado para o domínio do dashboard.

## Tipos compartilhados (espelhados em `web/src/lib/types.ts` e `supabase/functions/_shared/types.ts`)

```ts
export type LeadStatus =
  | 'novo' | 'pontuado' | 'pronto' | 'aprovado'
  | 'enviado' | 'respondeu' | 'fechou' | 'descartado' | 'nao_perturbe';

export type NicheTier = 'quente' | 'morno' | 'frio';
export type JobStatus = 'pending' | 'running' | 'done' | 'error';
export type SendStatus = 'agendado' | 'enviado' | 'falhou' | 'cancelado';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  niche: string | null;
  niche_tier: NicheTier | null;
  rating: number | null;
  num_reviews: number | null;
  has_instagram: boolean;
  instagram_url: string | null;
  maps_url: string | null;
  has_website: boolean;
  score: number | null;
  reasoning_score: string | null;
  status: LeadStatus;
  created_at: string;
}

export interface Message {
  id: string;
  lead_id: string;
  text: string;
  justification: string;
  model_used: string;
  approved: boolean;
  created_at: string;
}

export interface ScrapeJob {
  id: string;
  status: JobStatus;
  niche: string;
  city: string;
  target_count: number;
  found_count: number;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}
```

## EF-1 `score-leads`
Pontua e classifica leads com `status='novo'`.

- **Trigger:** pg_cron (`*/5`) ou chamada manual `POST /functions/v1/score-leads`.
- **Body (opcional):** `{ "lead_ids"?: string[], "limit"?: number }` (default: todos `novo`, limit 50).
- **Processo:** monta prompt (ver [04-ai-prompts.md](04-ai-prompts.md) §Scoring) → Gemini → parse JSON.
- **Resposta Gemini esperada (por lead):**
```json
{ "lead_id": "uuid", "score": 0, "niche": "estética", "niche_tier": "quente", "reasoning_score": "..." }
```
- **Efeito:** `update leads set score, niche, niche_tier, reasoning_score, status='pontuado'`.
- **Output:** `{ "scored": number }`.
- **Erros:** 422 (parse Gemini falhou — não muda status, loga), 500.

## EF-2 `generate-messages`
Gera mensagem + justificativa para os melhores leads `pontuado` do dia.

- **Trigger:** pg_cron ou `POST /functions/v1/generate-messages`.
- **Body (opcional):** `{ "limit"?: number }` (default `settings.daily_send_limit` = 6).
- **Seleção:** `leads where status='pontuado' order by score desc limit N` (descontando os já com mensagem do dia).
- **Resposta Gemini esperada (por lead):**
```json
{ "lead_id": "uuid", "message": "Oi Bella! Vi que...", "justification": "Nicho estética 6,8%..." }
```
- **Efeito:** `insert into messages (...)`; `update leads set status='pronto'`.
- **Output:** `{ "generated": number }`.

## EF-3 `enqueue-sends`
Aprova mensagens e agenda envios com throttle de 3 min.

- **Trigger:** front, `POST /functions/v1/enqueue-sends`.
- **Body:** `{ "message_ids": string[] }` (Zod: array não-vazio de uuid).
- **Processo (RN-SEND-01):** para cada message: `update messages set approved=true, approved_at=now()`; `update leads set status='aprovado'`; `insert into sends` com `scheduled_at` = próximo slot livre (espaçamento de `settings.send_interval_minutes`).
- **Output:** `{ "enqueued": number, "first_at": iso, "last_at": iso }`.
- **Erros:** 400 (body inválido), 409 (mensagem já aprovada).

> Alternativa MVP simples: o front faz `update messages.approved=true` direto (via RLS) e um cron transforma aprovados em `sends`. `enqueue-sends` é a versão explícita/recomendada.

## EF-4 `process-send-queue`
Dispara no máximo **1** mensagem por execução, respeitando o gap de 3 min.

- **Trigger:** pg_cron (`* * * * *`, a cada 1 min).
- **Processo:**
  1. Existe `sends` com `status='enviado'` e `sent_at > now() - interval '3 min'`? → **aborta** (ainda no cooldown).
  2. Pega `sends where status='agendado' and scheduled_at <= now() order by scheduled_at limit 1`.
  3. Monta payload uazapi (ver §uazapi), dispara, `update sends set status='enviado', sent_at=now(), uazapi_response`.
  4. `update leads set status='enviado'`.
- **Output:** `{ "sent": 0 | 1, "reason"?: string }`.

## Contrato uazapi (envio de texto)

```http
POST {UAZAPI_BASE_URL}/send/text
Headers: token: {UAZAPI_TOKEN}
Body: { "number": "5585999999999", "text": "<message.text>" }
```
- `number` = `lead.phone` em E.164 sem `+` (padrão uazapi). Validar antes de enviar.
- Resposta crua salva em `sends.uazapi_response`. Falha → `status='falhou'`, `error_message`.
- (Detalhes completos da uazapi: usar a skill `uazapi-whatsapp` na implementação.)

## Eventos Realtime (consumidos pelo front)

- Canal: `postgres_changes` na tabela `scrape_jobs` (event `UPDATE`), filtrado por `id=eq.<jobId>`.
- O front usa o payload para atualizar `found_count` e `status` ao vivo.
- Também pode assinar `leads` (INSERT) para feedback adicional, opcional.

## Agente local ↔ Supabase (não é HTTP próprio — usa client supabase-py com service_role)

- Poll: `select * from scrape_jobs where status='pending' order by created_at limit 1`.
- Claim: `update scrape_jobs set status='running', started_at=now() where id=? and status='pending'` (evita corrida).
- Progresso: `update scrape_jobs set found_count=? where id=?` a cada lead inserido.
- Insert lead: `insert into leads (...) on conflict (phone) do nothing` (dedupe).
- Fim: `update scrape_jobs set status='done', finished_at=now()`.
