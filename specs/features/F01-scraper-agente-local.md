# F01 — Scraper + Agente Local (Python/Playwright)

## Objetivo
Programa Python rodando na máquina do usuário que consome a fila `scrape_jobs`, raspa o Google Maps por empresas **sem site** com comportamento humano, e grava os leads no Supabase atualizando o progresso ao vivo.

## Escopo
**DENTRO:** loop de poll da fila; automação Playwright (navegador real); detecção de "sem site"; parsing de nome/telefone/rating/reviews/instagram; dedupe; atualização de `found_count`; tratamento de erro do job.
**FORA:** scoring e mensagens (F03), UI (F05), schema (F02 — só consome).

## Dependências
- 02-data-model (`scrape_jobs`, `leads`) e 03-api-contracts (§Agente local ↔ Supabase) implementados.
- Contratos: C1 (tipos), C3 (schema), C5 (protocolo de fila).

## Comportamento detalhado
- **RN-01 (poll):** a cada `POLL_INTERVAL` (default 5s) busca 1 job `pending` mais antigo; faz o *claim* atômico (`update ... where status='pending'`). Se ninguém pegou, processa.
- **RN-02 (queries):** monta termos de busca a partir de `niche`+`city`. (Opcional: expandir via Gemini, ver 04-ai-prompts.) Ex.: "estética Fortaleza CE".
- **RN-03 (browser):** Playwright com **`headless=False`** (navegador real visível) + `playwright-stealth`. User-agent real. Uma aba/sessão por vez.
- **RN-04 (humano):** entre ações, `human_behavior` aplica delays aleatórios (2–6s), scroll incremental na lista de resultados, pequenos movimentos de mouse. Sem paralelismo agressivo.
- **RN-05 (filtro sem site):** para cada empresa, abrir/inspecionar o card. Se houver botão/link de **site (website)** → **descartar** (tem site). Considerar lead válido quando NÃO há site. Se só houver link de Instagram → `has_instagram=true`, `instagram_url`.
- **RN-06 (parsing):** extrair `name`, `raw_phone`→`phone` (normalizar E.164 BR, ex.: 55 + DDD + número), `address`, `category_maps`, `rating`, `num_reviews`, `maps_url`.
- **RN-07 (telefone obrigatório):** sem telefone válido → não inserir (ou inserir com flag, mas por padrão pular — sem WhatsApp não serve).
- **RN-08 (dedupe):** `insert ... on conflict (phone) do nothing`. Não conta duplicado no `found_count`.
- **RN-09 (progresso):** a cada lead efetivamente inserido, `update scrape_jobs set found_count = found_count + 1`.
- **RN-10 (parada):** para quando atingir `target_count` OU acabarem os resultados. Marca `status='done'`, `finished_at`.
- **RN-11 (erro):** exceção não recuperável → `status='error'`, `error_message`; fecha o browser; volta ao poll.
- **RN-12 (bloqueio/CAPTCHA):** se detectar CAPTCHA/bloqueio → pausa, marca job `error` com mensagem clara ("bloqueio detectado, tente mais tarde"), não insiste em loop.

## Interface / Contrato
- Consome C5 (protocolo de fila do 03-api-contracts). Não expõe HTTP próprio.
- Usa `SUPABASE_SERVICE_ROLE_KEY` (ambiente local confiável).

## Critérios de aceitação
- AC1: Dado um `scrape_jobs` `pending`, quando o agente está rodando, então ele marca `running`, abre o navegador e começa a inserir leads.
- AC2: Dado uma empresa com site no Maps, quando processada, então **não** vira lead.
- AC3: Dado uma empresa sem site e com telefone, quando processada, então vira lead `status='novo'` e `found_count` incrementa em 1.
- AC4: Dado dois resultados com o mesmo telefone, quando processados, então só 1 lead existe (dedupe).
- AC5: Dado `target_count=50`, quando 50 leads forem inseridos, então o job vira `done`.
- AC6: Dado um CAPTCHA, quando detectado, então o job vira `error` com mensagem e o loop não trava.

## Testes obrigatórios
- Unit: normalização de telefone (vários formatos BR → E.164).
- Unit: parser de card (HTML fixture) → campos corretos; detecção de "tem site" vs "só instagram".
- Unit: `human_behavior` gera delays dentro da faixa.

## Riscos / notas
- Maps muda o DOM com frequência → isolar seletores em `parsers.py` para manutenção fácil.
- Headful exige sessão de desktop ativa (ok, é local).
- Respeitar volume baixo (~50/sessão, poucas vezes/semana) é o que mantém o IP limpo.
