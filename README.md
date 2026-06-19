# ai_prospect 🎯

![status](https://img.shields.io/badge/status-MVP_funcional-success)
![python](https://img.shields.io/badge/Python-3.12-blue)
![typescript](https://img.shields.io/badge/TypeScript-React_18-3178c6)
![supabase](https://img.shields.io/badge/Supabase-Postgres_%2B_Edge-3ecf8e)
![license](https://img.shields.io/badge/license-MIT-black)

**Automação de prospecção B2B para venda de landing pages.** Garimpa empresas **sem site** no Google Maps, usa IA (Gemini) para **priorizar** os leads mais quentes e **escrever mensagens de captação personalizadas por nicho**, e dispara via **WhatsApp (uazapi)** com **aprovação humana por clique** e **throttle de 1 envio a cada 3 minutos** — tudo operado por um **dashboard web**.

Este repositório é, antes de tudo, um **estudo de caso de engenharia**: um sistema pequeno mas completo, que costura scraping, banco serverless, IA generativa e automação de mensagens num fluxo só. A intenção não é "rode em produção como está" — é deixar claro **como as peças se encaixam** e servir de base pra você ler, adaptar, quebrar e melhorar. Se você é dev em começo/meio de carreira procurando um projeto real (não um to-do app) pra estudar arquitetura ponta a ponta, é pra você.

---

## 🧠 O que dá pra estudar aqui

Cada item abaixo é uma decisão de arquitetura com trade-offs reais — boa matéria-prima pra entender *por que* foi feito assim (e questionar):

- **Scraping com browser real** — Python + Playwright **não-headless** rodando localmente (IP residencial) em vez de headless na nuvem. Por quê? Anti-bloqueio. Veja a simulação de comportamento humano em [`agent/scraper/human_behavior.py`](agent/scraper/human_behavior.py).
- **Orquestração serverless** — Supabase Postgres + `pg_cron` chamando **Edge Functions** (Deno/TS) em intervalos, sem servidor próprio. O dashboard nunca fala direto com o WhatsApp; ele só enfileira no banco.
- **Fila com throttle e cooldown** — a lógica pura de "1 envio a cada N min, mesmo aprovando vários de uma vez" está isolada e testada em [`supabase/functions/_shared/throttle.ts`](supabase/functions/_shared/throttle.ts). Ótimo exemplo de como extrair regra de negócio testável de I/O.
- **IA como etapa de pipeline** — Gemini faz duas coisas distintas: *scoring* (0–100) e *copywriting* por nicho. Prompts versionados como código em [`specs/04-ai-prompts.md`](specs/04-ai-prompts.md).
- **Humano no loop** — nada é enviado automaticamente; a IA propõe, a pessoa aprova por clique. Um padrão útil pra qualquer automação com risco.
- **Segurança por camadas** — `service_role` e chaves de IA/WhatsApp só no agente local e nas Edge Functions; o frontend só conhece a `anon key`. RLS no banco.
- **Spec-Driven Development** — todo o sistema foi especificado antes em [`specs/`](specs/). Dá pra comparar spec × implementação e ver como a documentação guia o código.

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

> **Contexto de negócio (pra dar sentido às métricas):** o produto vendido é uma landing
> page (~R$ 797); a meta hipotética é ~3–4 vendas/mês a cada ~300 empresas prospectadas
> (~1,2% de conversão). São números de exemplo — o que importa aqui é o pipeline.

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
| Frontend | React 18 + Vite + TypeScript + Tailwind + Framer Motion + Recharts (Vercel) |

---

## 📁 Estrutura do repositório

```
ai_prospect/
├── specs/          📘 Documentação SDD (LEIA PRIMEIRO — é o que guiou toda a construção)
├── agent/          🐍 Agente local Python + scraper (Playwright) + testes
├── supabase/       🗄️ Migrations (Postgres/RLS/cron) + Edge Functions (Deno/TS) + testes
└── web/            🖥️ Dashboard React (Vite + Tailwind) + testes
```

### Por onde começar a ler o código

1. [`specs/00-overview.md`](specs/00-overview.md) — o mapa mental do sistema e o glossário.
2. [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — o **modelo de dados** é a espinha dorsal; entenda as tabelas antes do resto.
3. [`supabase/functions/_shared/`](supabase/functions/_shared/) — a lógica compartilhada (throttle, prompts, tipos) e os testes que a cercam.
4. [`agent/scraper/`](agent/scraper/) — o scraper e o parsing (com testes puros, fáceis de seguir).
5. [`web/src/pages/`](web/src/pages/) — cada aba do dashboard é uma página independente.

> **Estado atual:** MVP funcional. A documentação SDD em [`specs/`](specs/) é a fonte
> da verdade; o código implementa as specs. Suítes de teste (Python + web) passando.

---

## 📘 Documentação SDD (Spec-Driven Development)

Este projeto foi construído por **specs executáveis** — o código implementa a spec, não improvisa. É um bom lugar pra ver como documentação e código convivem:

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

## 🛠️ Rodando localmente

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

Variáveis de ambiente: copie de [`.env.example`](.env.example) (cada chave tem instrução de onde pegar).
O `.env.example` usa `YOUR_PROJECT_REF` como placeholder — substitua pelo ref do seu projeto Supabase.
Passo a passo completo de deploy em **[DEPLOY.md](DEPLOY.md)**.

---

## 🧪 Rodando os testes

```bash
# Agente Python (parsers, throttle/scheduling, comportamento humano)
cd agent && pip install -e . && pip install pytest && pytest -q

# Dashboard web (hooks/métricas)
cd web && npm install && npm test

# Edge Functions (Deno) — lógica de prompts e throttle
cd supabase && deno test functions/_shared/
```

---

## 🧩 Ideias de melhoria (pegue uma e mande ver)

O projeto é propositalmente enxuto — sobra espaço pra evoluir. Algumas trilhas, da mais
tranquila à mais profunda:

**Bom primeiro PR**
- Mover `web/tsconfig.tsbuildinfo` (artefato de build) para o `.gitignore`.
- Lazy-load do Recharts com `import()` dinâmico — o chunk de gráficos é o maior do bundle.
- Adicionar *empty states* e mensagens de erro mais claras nas páginas que ainda não têm.
- Workflow de **CI** (GitHub Actions) rodando lint + testes + build em cada PR.

**Intermediário**
- **Tema claro / toggle** — os tokens de cor já estão centralizados em [`web/src/index.css`](web/src/index.css); falta a variante light.
- Trocar o drag-and-drop nativo do CRM por **@dnd-kit** (ganha suporte a toque/mobile).
- Assinar o dashboard ao **Supabase Realtime** para as métricas se atualizarem sozinhas (hoje busca uma vez).
- Testes de componente (React Testing Library) e um *smoke* e2e com Playwright.
- **Paginação/virtualização** da lista de leads no CRM (hoje limitada a 500).

**Mais profundo**
- Retomada/resync de jobs de scraping interrompidos e estratégia de rotação de proxy.
- Observabilidade: logging estruturado + tracing das Edge Functions e do agente.
- Camada de testes de integração ponta a ponta (agente → banco → EF → fila).
- Generalizar o nicho/cidade pra outros mercados além de estética.

Não tem issue formal pra cada uma — escolha, abra uma issue descrevendo a abordagem e siga.

---

## 🤝 Contribuindo

1. Leia a [`CONSTITUTION.md`](specs/CONSTITUTION.md) — ela define as regras de stack, pastas e segurança.
2. Antes de mexer numa área, dê uma olhada na spec correspondente em [`specs/`](specs/).
3. Mantenha os testes passando (`pytest` / `vitest` / `deno test`) e rode `npm run lint` no `web/`.
4. Segredos **nunca** no código — só via `.env` (já no `.gitignore`).

PRs e issues são bem-vindos, inclusive os de "isso aqui podia ser melhor porque…". É pra isso que o repo está aberto.

---

## ⚖️ Notas importantes

- **Agente local obrigatório:** o scraping roda na sua máquina (IP residencial) para reduzir bloqueio. O dashboard na nuvem aciona o agente via fila no Supabase.
- **Anti-ban:** volume baixo (~50/sessão, poucas vezes/semana), 6 envios/dia, 1 msg a cada 3 min, aprovação manual. Esses limites são intencionais.
- **LGPD:** dados de empresas (PJ) são públicos; as mensagens incluem opt-out ("responda SAIR"); leads que pedem saída viram `nao_perturbe`.
- **Uso responsável:** automação de mensagens tem implicações legais e de reputação. Respeite os termos do WhatsApp e a legislação local antes de usar pra valer.

---

## 📄 Licença

Distribuído sob a licença **MIT** — veja [LICENSE](LICENSE). Sinta-se à vontade para estudar, reusar e adaptar.
