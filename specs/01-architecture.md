# 01 — Arquitetura do Sistema

## Diagrama ponta-a-ponta

```
┌──────────────────────────────────────────────────────────────────────────┐
│  DASHBOARD (React + Vite na Vercel)                                        │
│  • Botão [Começar Mapeamento]                                             │
│  • Contador ao vivo "X empresas captadas" (Supabase Realtime)            │
│  • 6 cards/dia com mensagem + justificativa da IA                        │
│  • [Aprovar e enviar]  • Funil + métricas + gráficos                     │
└───────────┬───────────────────────────────────────────────┬──────────────┘
            │ (anon key: read + insert job + approve)        │ Realtime subscribe
            ▼                                                 ▲
┌──────────────────────────────────────────────────────────────────────────┐
│  SUPABASE (Postgres + Realtime + Edge Functions + pg_cron)                │
│                                                                            │
│  Tabelas: scrape_jobs · leads · messages · sends · settings              │
│                                                                            │
│  Edge Functions (Deno/TS):                                                │
│   • score-leads        → Gemini: nota 0-100 + classificação nicho        │
│   • generate-messages  → Gemini: 6 mensagens/dia + justificativa         │
│   • enqueue-sends      → aprovados → cria linhas em sends (agendadas)     │
│   • process-send-queue → dispara 1 msg/3min via uazapi (chamada por cron) │
│                                                                            │
│  pg_cron:                                                                  │
│   • a cada 1 min  → process-send-queue (respeita o gap de 3 min)         │
│   • a cada N min  → score-leads + generate-messages (processa pendentes) │
└───────┬──────────────────────────────────────────────────┬───────────────┘
        │ service_role (poll/escrita)                        │ HTTPS
        ▼                                                    ▼
┌─────────────────────────────┐                  ┌──────────────────────────┐
│  AGENTE LOCAL (Python)      │                  │  uazapi (WhatsApp)       │
│  na máquina do usuário      │                  │  instância do usuário    │
│  • poll scrape_jobs         │                  │  envia mensagem ao lead  │
│  • Playwright (navegador    │                  └──────────────────────────┘
│    REAL, visível) + stealth │
│  • capta empresas SEM site  │                  ┌──────────────────────────┐
│  • atualiza found_count      │─── Gemini ──────▶│  Google Gemini 2.5 Flash │
│    (Realtime → dash)         │  (queries/limpeza)└──────────────────────────┘
│  • insere leads             │
└──────────┬──────────────────┘
           │ Playwright
           ▼
┌─────────────────────────────┐
│  Google Maps (web)          │
└─────────────────────────────┘
```

## Fluxos principais

### Fluxo A — Mapeamento (botão → contador ao vivo)
1. Usuário clica **[Começar Mapeamento]** no dashboard (escolhe nicho + cidade, ou usa presets de `settings`).
2. Front faz `insert` em `scrape_jobs` com `status='pending'`, `niche`, `city`, `target_count`.
3. O **agente local** (rodando no PC) faz poll de `scrape_jobs` a cada ~5s. Acha job `pending` → marca `running`.
4. (Opcional/IA) agente chama Gemini para expandir o termo em várias queries de busca do Maps.
5. Playwright abre **navegador real visível**, busca no Maps, percorre resultados com comportamento humano.
6. Para cada empresa **sem `websiteUri`/sem site**: parseia dados, faz **dedupe** por telefone, `insert` em `leads` (`status='novo'`), e incrementa `scrape_jobs.found_count`.
7. O dashboard **assina via Realtime** a linha do job → mostra "🔄 Mapeando... N empresas captadas" subindo.
8. Fim → agente marca `status='done'`, `finished_at`. Dash mostra "✅ N empresas captadas".

### Fluxo B — IA pontua e escreve
1. pg_cron (ou trigger pós-mapeamento) invoca **score-leads** para leads `status='novo'`.
2. Gemini retorna por lead: `score`, `niche_normalizado`, `niche_tier`, `reasoning_score`. Lead → `status='pontuado'`.
3. **generate-messages** seleciona os **6 melhores ainda não preparados do dia** (ordenando por score desc).
4. Gemini retorna `{ message, justification }` por lead. Cria linha em `messages`. Lead → `status='pronto'`.

### Fluxo C — Aprovação + envio com throttle
1. Dashboard lista os leads `status='pronto'` com mensagem + justificativa.
2. Usuário clica **[Aprovar e enviar]** → front chama **enqueue-sends** (ou `update messages.approved=true`).
3. enqueue-sends cria linhas em `sends` com `scheduled_at` espaçados de **3 min** (próximo slot livre).
4. pg_cron chama **process-send-queue** a cada 1 min: pega o `sends` com `scheduled_at <= now()` e `status='agendado'` mais antigo, **dispara 1** via uazapi, marca `enviado`, respeitando o gap de 3 min entre envios.
5. Webhook do uazapi (futuro) atualiza `respondeu`. Vendas marcadas manualmente (`fechou`).

## Decisões de arquitetura (ADRs curtos)

**ADR-01 — Agente local + fila no Supabase (não scraping na nuvem).**
Contexto: scraping precisa de IP residencial; front está na nuvem. Decisão: Supabase como fila; agente Python local consome. Trade-off aceito: usuário precisa ligar o agente para mapear. Alternativa rejeitada: scraping em servidor (toma CAPTCHA/ban).

**ADR-02 — Navegador real visível, não headless.**
Contexto: headless é mais detectável; usuário pediu ver progresso pelo front (não pela tela do browser). Decisão: Playwright `headless=False`, e o "ver progresso" é o contador via Realtime. Trade-off: o browser abre na máquina, mas o acompanhamento oficial é o dashboard.

**ADR-03 — Gemini só via Edge Function.**
Nunca chamar Gemini do front (key vaza). O agente local pode chamar Gemini direto (ambiente confiável) para queries/limpeza.

**ADR-04 — Throttle por agendamento no banco, não sleep.**
`sends.scheduled_at` espaçado de 3 min + cron de 1 min. Evita processos longos e é resiliente a restart.

**ADR-05 — Aprovação humana obrigatória.**
Reduz risco de ban e garante qualidade da mensagem (fator nº1 de conversão). Sem auto-send no MVP.

## Deploy

- **web/** → Vercel (build Vite). Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **supabase/** → projeto Supabase (migrations via `db push`, functions via `functions deploy`). Secrets via `supabase secrets set`.
- **agent/** → roda local. Distribuído como pasta + instruções no README (ou empacotado depois).
