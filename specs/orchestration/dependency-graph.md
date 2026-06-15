# Orchestration — Grafo de Dependências (DAG)

> Ordem de construção das tarefas. Cada tarefa = 1 sessão/agente + (idealmente) 1 branch/worktree.

## Tarefas

| ID | Tarefa | Spec | Depende de | Escopo de escrita |
|---|---|---|---|---|
| **T0** | Fundação Supabase (schema, RLS, cron, tipos) | F02 | — | `supabase/migrations/`, `supabase/config.toml`, gerar `web/src/lib/types.ts` base |
| **T1** | Agente local + Scraper | F01 | T0 | `agent/**` |
| **T2** | Edge Functions de IA (scoring + mensagens) | F03 | T0 | `supabase/functions/score-leads/`, `generate-messages/`, `_shared/gemini.ts`, `_shared/types.ts`, `_shared/cors.ts` |
| **T3** | Edge Functions de envio (aprovação + throttle) | F04 | T0, T2 | `supabase/functions/enqueue-sends/`, `process-send-queue/`, `_shared/uazapi.ts` |
| **T4** | Dashboard Web | F05 | T0 (consome dados); integra com T2/T3 | `web/**` (exceto `types.ts` base que vem de T0) |
| **T5** | Integração + E2E + ajustes finais | todas | T1..T4 | testes de integração, README final, .env |

## Ondas de execução

```
Onda 1 (sequencial):   T0                         ← fundação, bloqueia tudo
Onda 2 (paralelo):     T1 · T2 · T4               ← agente, IA e UI não colidem em arquivos
Onda 3 (sequencial):   T3                          ← envio depende das mensagens (T2)
Onda 4 (sequencial):   T5                          ← integração e verificação final
```

> Observação: T4 (web) pode começar contra dados mockados/seed enquanto T2/T3 finalizam; a integração real acontece na Onda 3/4.

## Mapa de arquivos por tarefa (checagem de colisão)

```
T0 escreve:  supabase/migrations/**, supabase/config.toml, web/src/lib/types.ts (base)
T1 escreve:  agent/**
T2 escreve:  supabase/functions/score-leads/**, generate-messages/**, _shared/{gemini,types,cors}.ts
T3 escreve:  supabase/functions/enqueue-sends/**, process-send-queue/**, _shared/uazapi.ts
T4 escreve:  web/** (menos lib/types.ts base)
```
**Sem colisão na mesma onda.** `_shared/types.ts` é criado por T2 a partir do contrato C1 (T0 gera o tipo base do banco; T2 consolida os tipos de domínio compartilhados). Se houver risco de colisão em `_shared`, T2 cria e T3 apenas lê/estende.

## Gates humanos
- Após T0: revisar schema + RLS + cron (contrato C3 congelado).
- Após Onda 2: revisar agente, EFs de IA e UI antes de plugar o envio.
- Após T3: revisar throttle/anti-ban antes de qualquer disparo real.
- T5: smoke test ponta-a-ponta com 1–2 leads reais antes de operar.
