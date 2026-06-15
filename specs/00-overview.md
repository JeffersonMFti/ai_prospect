# 00 — Overview & Índice

> Comece por aqui. Este arquivo é o mapa da documentação SDD do **ai_prospect**.

## Como navegar

| Documento | O que contém |
|---|---|
| [CONSTITUTION.md](CONSTITUTION.md) | Regras inegociáveis: stack, pastas, DoD, comandos, protocolo do agente. **Leitura obrigatória.** |
| [01-architecture.md](01-architecture.md) | Arquitetura de sistema, fluxo ponta-a-ponta, deploy, ADRs. |
| [02-data-model.md](02-data-model.md) | Schema completo do Supabase: tabelas, colunas, índices, RLS, pg_cron. |
| [03-api-contracts.md](03-api-contracts.md) | Contratos das Edge Functions e formato de eventos Realtime. |
| [04-ai-prompts.md](04-ai-prompts.md) | Prompts do Gemini (scoring + mensagem) e lógica de negócio da IA. |
| [features/F01..F05](features/) | Uma spec por frente de trabalho. |
| [orchestration/](orchestration/) | DAG de tarefas, contratos congelados e briefs dos agentes. |

## Glossário

- **Lead**: empresa captada do Google Maps que (em princípio) não tem site.
- **Agente local**: programa Python na máquina do usuário que roda o Playwright. NÃO confundir com "agente de IA".
- **Fila de mapeamento** (`scrape_jobs`): tabela que serve de ponte entre o botão na web e o agente local.
- **Nota / score**: número 0–100 que a IA dá a cada lead (quente → morno).
- **Mensagem**: texto de captação personalizado gerado pela IA por lead.
- **Justificativa**: explicação da IA sobre por que a mensagem ficou daquele jeito (log de raciocínio).
- **Fila de envio** (`sends`): leads aprovados aguardando disparo, 1 a cada 3 min.
- **uazapi**: API de WhatsApp usada para disparar as mensagens.

## Visão de produto (resumo)

Esteira em 4 estágios, do clique ao fechamento:

```
[Começar Mapeamento]  →  Scraper local capta ~50 empresas sem site (contador ao vivo)
        ↓
IA pontua (0-100) e classifica nicho  →  ranqueia quente → morno
        ↓
IA escreve 6 mensagens/dia + justificativa  →  card no dashboard
        ↓
Você aprova por clique  →  fila dispara 1 msg a cada 3 min via WhatsApp
        ↓
Dashboard acompanha funil, conversão por nicho e receita
```

## Metas e premissas

- **Meta de negócio:** 3–4 vendas/mês a cada ~300 prospectados (~1,2% conversão — realista, exige bom targeting + personalização).
- **Volume:** ~50 leads por sessão de scraping; **6 envios/dia**; scraper roda algumas vezes por semana (não diário).
- **Produto vendido:** landing page R$ 797 à vista ou 10x sem juros.
- **Custo de operação alvo:** ~R$ 0/mês (Supabase free + Vercel free + Gemini Flash em centavos + uazapi já contratado + scraper local).
