# CONSTITUTION — ai_prospect

> Documento lido por **todo** agente/sessão de implementação antes de escrever qualquer linha de código.
> Regras inegociáveis. Se algo aqui conflitar com uma spec, **a Constitution vence** — pare e reporte.

---

## 1. O que é o projeto (1 parágrafo)

Sistema de automação de prospecção B2B para venda de **landing pages** (R$ 797 à vista ou 10x sem juros).
Ele garimpa empresas **sem site** no Google Maps, usa IA (Gemini) para **priorizar** os leads mais quentes e
**escrever mensagens de captação personalizadas por nicho**, e dispara essas mensagens via **WhatsApp (uazapi)**
com **aprovação humana por clique** e **throttle de 1 envio a cada 3 minutos**. Tudo é operado e acompanhado por
um **dashboard web** com métricas e funil. Meta de negócio: **3–4 vendas/mês a cada ~300 empresas prospectadas**.

---

## 2. Stack travada

| Camada | Tecnologia | Versão | Observação |
|---|---|---|---|
| **Agente local + Scraper** | Python | 3.12+ | Roda na máquina do usuário (IP residencial). |
| Browser automation | Playwright (Python) | >=1.45 | **Navegador real, NÃO headless** (decisão do produto — menor detecção + UX). |
| Stealth | `playwright-stealth` | latest | + delays aleatórios, scroll humano, mouse move. |
| Cliente Supabase (Python) | `supabase` (supabase-py) | >=2.x | Poll da fila + escrita de leads/progresso. |
| **Banco + Cérebro** | Supabase (Postgres) | — | pg_cron + Edge Functions + Realtime + RLS. |
| Edge Functions | TypeScript / Deno | — | Scoring, geração de mensagem, disparo uazapi. |
| LLM | **Google Gemini 2.5 Flash** | API v1 | Pós-pago. Pro só se mensagens ficarem genéricas. |
| **Frontend** | React + Vite + TypeScript | React 18, Vite 5 | Deploy na Vercel. |
| UI | Tailwind CSS + shadcn/ui | Tailwind 3.x | Componentes headless + design tokens. |
| Data/Realtime no front | `@supabase/supabase-js` | >=2.x | Queries + subscription Realtime. |
| Gráficos | Recharts | >=2.x | Métricas do dashboard. |
| **WhatsApp** | uazapi (uazapiGO V2) | — | Instância já contratada (plano 100 devices). |

### Proibido
- ❌ Scraping rodando em servidor cloud (IP de datacenter = CAPTCHA garantido). O scraper **só** roda no agente local.
- ❌ Modo headless no Playwright (decisão explícita do produto).
- ❌ Enviar WhatsApp em massa / de uma vez. Sempre fila com throttle de 3 min.
- ❌ Enviar mensagem sem aprovação humana.
- ❌ Commitar segredos (API keys, service_role, token uazapi). Só via env.
- ❌ Inventar bibliotecas de state manager exóticas no front. Use React state + hooks + Supabase como fonte de verdade.
- ❌ Chamar Gemini direto do frontend (a key vaza). Só via Edge Function.

---

## 3. Estrutura de pastas (árvore canônica)

```
ai_prospect/
├── README.md
├── .env.example
├── .gitignore
├── specs/                          # ESTA documentação (SDD)
│
├── agent/                          # Agente local Python (scraper)
│   ├── pyproject.toml
│   ├── .env.example
│   ├── main.py                     # loop: poll fila → roda scraper → atualiza progresso
│   ├── config.py
│   ├── supabase_client.py
│   ├── scraper/
│   │   ├── maps_scraper.py         # Playwright: busca empresas sem site
│   │   ├── human_behavior.py       # delays, scroll, mouse
│   │   └── parsers.py              # extrai nome, telefone, rating, reviews, instagram
│   └── tests/
│
├── supabase/                       # Backend (Supabase)
│   ├── migrations/                 # SQL versionado (schema + RLS + pg_cron)
│   │   └── 0001_init.sql
│   ├── functions/                  # Edge Functions (Deno/TS)
│   │   ├── score-leads/index.ts    # Gemini: nota + classificação
│   │   ├── generate-messages/index.ts  # Gemini: mensagem + justificativa
│   │   ├── enqueue-sends/index.ts  # aprovados → fila de envio
│   │   ├── process-send-queue/index.ts # dispara 1 msg/3min via uazapi
│   │   └── _shared/                # gemini.ts, uazapi.ts, types.ts, cors.ts
│   └── config.toml
│
└── web/                            # Dashboard (React + Vite)
    ├── package.json
    ├── .env.example
    ├── index.html
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── lib/
    │   │   ├── supabase.ts         # client
    │   │   └── types.ts            # tipos compartilhados (espelham contratos)
    │   ├── hooks/                  # useLeads, useScrapeJob, useMetrics, useSendQueue
    │   ├── components/             # UI (cards, funil, gráficos)
    │   └── pages/                  # Dashboard, Aprovacao, Leads, Mapeamento
    └── tests/
```

---

## 4. Padrões de código

### Python (agent/)
- Formatter/linter: **ruff** (format + lint). Type hints obrigatórios em funções públicas.
- Nomes: `snake_case` funções/variáveis, `PascalCase` classes, `UPPER_SNAKE` constantes.
- Toda I/O externa (Playwright, Supabase) com try/except + log estruturado; nunca silenciar erro.
- Config só via env (`config.py` lê `os.environ`); nada hardcoded.

### TypeScript (supabase/functions e web/)
- Linter/formatter: **ESLint + Prettier** (config no `web/`). Edge functions seguem o mesmo estilo.
- Nomes: `camelCase` (vars/funções), `PascalCase` (componentes/tipos), `kebab-case` (arquivos de componente).
- **Validação de input em toda fronteira** com **Zod** (Edge Functions e formulários do front).
- Erros: Edge Functions retornam `{ error: string }` + status HTTP correto; nunca `throw` sem capturar na borda.
- Componentes React: função + hooks. Estados sempre tratados: `loading | empty | error | success`.

### SQL
- Migrations idempotentes quando possível, versionadas e numeradas (`0001_`, `0002_`...).
- Toda tabela com `id uuid default gen_random_uuid()`, `created_at timestamptz default now()`.
- **RLS habilitado em todas as tabelas.** Acesso do front é via `anon` key com policies; escrita sensível via `service_role` (Edge Functions / agente).

---

## 5. Definition of Done (DoD) — vale para toda tarefa

- [ ] Código roda / typecheck passa (`ruff check` no agent; `tsc --noEmit` no web/functions).
- [ ] Lint passa (`ruff format --check` / `eslint .`).
- [ ] Testes da tarefa escritos e passando.
- [ ] Sem `TODO`/`FIXME`/mock esquecido (a menos que a spec mande, marcado com `// SPEC-GAP:`).
- [ ] Arquivos novos batem com a estrutura de pastas desta Constitution.
- [ ] Contratos de interface (`specs/orchestration/interface-contracts.md`) respeitados sem alteração unilateral.
- [ ] Variáveis de ambiente novas adicionadas ao `.env.example` correspondente.
- [ ] Nenhum segredo no código ou no git.

---

## 6. Estratégia de testes

- **agent/**: pytest. Unit nos parsers (HTML→lead) e em `human_behavior`. Scraper E2E é manual (depende do Maps).
- **supabase/functions/**: testes de unidade nas funções puras (montagem de prompt, parse da resposta Gemini, builder do payload uazapi). Deno test.
- **web/**: Vitest + Testing Library nos hooks e componentes críticos (funil, aprovação, contador realtime).
- Obrigatório testar: cálculo de métricas do funil, parse da resposta da IA (JSON), throttle de envio, dedupe de leads.

---

## 7. Segurança & compliance (LGPD)

- Segredos só via env (`GEMINI_API_KEY`, `UAZAPI_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`...). `.env` no `.gitignore`.
- Dados coletados são de **empresas (PJ)** e públicos no Maps — ainda assim: minimizar coleta (só o necessário p/ contato e scoring), guardar base legal (legítimo interesse B2B), e oferecer **opt-out** (lead pode ser marcado `descartado/nao_perturbe`).
- Mensagem de WhatsApp deve permitir descadastro ("responda SAIR"). Lead que pede saída → status `nao_perturbe`, nunca mais contatado.
- `service_role` key **jamais** vai pro frontend. Só no agente local e nas Edge Functions.
- Logs não guardam telefone em texto plano em sistemas de terceiros.

---

## 8. Comandos do projeto (a cola)

```bash
# agent/ (Python)
cd agent && python -m venv .venv && .venv/Scripts/activate   # Windows
pip install -e . && playwright install chromium
python main.py                       # liga o agente local (fica escutando a fila)
ruff check . && ruff format --check . && pytest

# supabase/
supabase start                       # stack local
supabase db push                     # aplica migrations
supabase functions deploy <nome>     # publica edge function
supabase functions serve             # roda functions local

# web/ (React)
cd web && npm install
npm run dev                          # dashboard local
npm run build                        # build de produção (Vercel)
npm run lint && npm run typecheck && npm run test
```

---

## 9. Protocolo do agente (como cada sub-agente se comporta)

1. **Leia**: esta Constitution + sua SPEC + os CONTRATOS listados no seu brief. Nada além do necessário.
2. **NÃO** altere arquivos fora do escopo de escrita do seu brief.
3. **NÃO** mude um contrato de interface. Se um contrato estiver errado/insuficiente, **PARE e reporte** — não improvise.
4. Ambiguidade na spec → escolha a interpretação **mais conservadora**, marque no código com `// SPEC-GAP:` e liste no relatório.
5. Ao terminar: rode o DoD e entregue o **Relatório de Encerramento** (formato em `specs/orchestration/agent-briefs.md`).
6. Segredo nenhum no código. Toda env nova vai pro `.env.example`.
