# ai_prospect 🎯

**Automação de prospecção B2B para venda de landing pages.** Garimpa empresas **sem site** no Google Maps, usa IA (Gemini) para **priorizar** os leads mais quentes e **escrever mensagens de captação personalizadas por nicho**, e dispara via **WhatsApp (uazapi)** com **aprovação humana por clique** e **throttle de 1 envio a cada 3 minutos** — tudo operado por um **dashboard web**.

> Produto vendido: landing page por **R$ 797 à vista ou 10x sem juros**.
> Meta de negócio: **3–4 vendas/mês a cada ~300 empresas prospectadas** (~1,2% de conversão).

---

## ✨ Como funciona (do clique ao fechamento)

```
[Começar Mapeamento]  →  Agente local capta ~50 empresas sem site (contador ao vivo no dash)
        ↓
IA pontua (0-100) e classifica nicho  →  ranqueia quente → morno
        ↓
IA escreve 6 mensagens/dia + justificativa  →  cards no dashboard
        ↓
Você aprova por clique  →  fila dispara 1 msg a cada 3 min via WhatsApp
        ↓
Dashboard acompanha funil, conversão por nicho e receita
```

---

## 🏗️ Arquitetura

```
Dashboard (React+Vite / Vercel)
   │  insere job + lê dados (anon key)        ▲ Realtime (contador ao vivo)
   ▼                                          │
Supabase (Postgres + Realtime + Edge Functions + pg_cron)
   ├─ Tabelas: scrape_jobs · leads · messages · sends · settings
   ├─ EFs: score-leads · generate-messages · enqueue-sends · process-send-queue
   └─ pg_cron: pontua/gera (5min) · processa fila de envio (1min, gap 3min)
   │  service_role                              │ HTTPS
   ▼                                            ▼
Agente local (Python + Playwright real)     uazapi (WhatsApp)   ◀─ Gemini 2.5 Flash
   └─ raspa Google Maps (empresas sem site)
```

Detalhes e ADRs em [`specs/01-architecture.md`](specs/01-architecture.md).

---

## 🧱 Stack

| Camada | Tecnologia |
|---|---|
| Agente local / scraper | Python 3.12, Playwright (navegador **real**, não headless), playwright-stealth, supabase-py |
| Backend / banco | Supabase (Postgres, RLS, Realtime, Edge Functions em Deno/TS, pg_cron) |
| IA | Google Gemini 2.5 Flash (pós-pago) |
| WhatsApp | uazapi (uazapiGO V2) |
| Frontend | React 18 + Vite + TypeScript + Tailwind + shadcn/ui + Recharts (Vercel) |

---

## 📁 Estrutura do repositório

```
ai_prospect/
├── specs/          📘 Documentação SDD (LEIA PRIMEIRO — é o que guia toda a construção)
├── agent/          🐍 Agente local Python + scraper (a construir)
├── supabase/       🗄️ Migrations + Edge Functions (a construir)
└── web/            🖥️ Dashboard React (a construir)
```

> **Estado atual:** a documentação SDD está completa. O código (`agent/`, `supabase/`, `web/`) é construído seguindo as specs, na ordem do DAG.

---

## 📘 Documentação SDD (Spec-Driven Development)

Este projeto é construído por **specs executáveis** — o código implementa a spec, não improvisa. Comece por aqui:

| Documento | Conteúdo |
|---|---|
| [`specs/00-overview.md`](specs/00-overview.md) | Mapa da documentação + glossário |
| [`specs/CONSTITUTION.md`](specs/CONSTITUTION.md) | **Regras inegociáveis** (stack, pastas, DoD, segurança) |
| [`specs/01-architecture.md`](specs/01-architecture.md) | Arquitetura, fluxos, ADRs, deploy |
| [`specs/02-data-model.md`](specs/02-data-model.md) | Schema completo (tabelas, RLS, cron) |
| [`specs/03-api-contracts.md`](specs/03-api-contracts.md) | Contratos das Edge Functions + Realtime |
| [`specs/04-ai-prompts.md`](specs/04-ai-prompts.md) | Lógica e prompts do Gemini (scoring + mensagens) |
| [`specs/features/`](specs/features/) | F01 scraper · F02 schema · F03 IA · F04 envio · F05 dashboard |
| [`specs/orchestration/`](specs/orchestration/) | DAG de tarefas, contratos congelados, briefs dos agentes |

---

## 🚀 Ordem de construção (DAG)

Veja [`specs/orchestration/dependency-graph.md`](specs/orchestration/dependency-graph.md).

```
Onda 1:  T0  Fundação Supabase (schema/RLS/cron)        ← bloqueia tudo
Onda 2:  T1 Agente+Scraper · T2 EFs de IA · T4 Dashboard  (paralelo)
Onda 3:  T3 EFs de Envio (throttle/uazapi)
Onda 4:  T5 Integração + E2E
```

Cada tarefa tem um **brief pronto** em [`specs/orchestration/agent-briefs.md`](specs/orchestration/agent-briefs.md) — cole no Claude Code (VSCode) para construir aquela parte.

---

## 🛠️ Setup (quando o código existir)

```bash
# 1) Banco — Supabase
supabase start && supabase db push
supabase functions deploy score-leads generate-messages enqueue-sends process-send-queue
supabase secrets set GEMINI_API_KEY=... UAZAPI_BASE_URL=... UAZAPI_TOKEN=...

# 2) Dashboard — web/
cd web && npm install && npm run dev      # deploy: Vercel

# 3) Agente local — agent/  (na SUA máquina)
cd agent && python -m venv .venv && .venv/Scripts/activate
pip install -e . && playwright install chromium
python main.py     # liga o agente: fica escutando a fila de mapeamento
```

Variáveis de ambiente: copie de [`.env.example`](.env.example) (detalhe em contrato C6).

---

## ⚖️ Considerações importantes

- **Agente local obrigatório:** o scraping roda na sua máquina (IP residencial) para não tomar bloqueio. O dashboard na nuvem aciona o agente via fila no Supabase.
- **Anti-ban:** volume baixo (~50/sessão, poucas vezes/semana), 6 envios/dia, 1 msg a cada 3 min, aprovação manual. Não burlar esses limites.
- **LGPD:** dados de empresas (PJ) públicos; mensagens incluem opt-out ("responda SAIR"); leads que pedem saída viram `nao_perturbe`.
- **Segredos:** nunca no código. `service_role` e chaves de IA/WhatsApp só no agente local e nas Edge Functions — jamais no frontend.

---

## 📈 Métricas no dashboard

Funil (garimpados → enviados → responderam → fecharam), taxa de resposta, taxa de fechamento vs meta (1,2%), receita gerada (fechados × R$ 797), conversão por nicho, distribuição de notas. Ver [`specs/features/F05-dashboard-web.md`](specs/features/F05-dashboard-web.md).
