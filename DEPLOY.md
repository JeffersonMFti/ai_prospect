# 🚀 Runbook de Deploy — ai_prospect

Do zero ao go-live. Siga na ordem. Tempo estimado: ~30 min.

> Antes de tudo: copie [`.env.example`](.env.example) e preencha as chaves (veja onde pegar lá).

---

## Pré-requisitos (instalar 1x)

```bash
node -v        # >= 20
python --version   # >= 3.12
npm i -g supabase   # Supabase CLI
```

---

## Passo 1 — Banco de dados (T0)
Você já aplicou `0001_init.sql` e `0002_cron.sql`, e pausou o cron. Nada a fazer aqui agora
(o cron é reativado no Passo 5, depois das funções no ar).

Conferir tabelas: https://supabase.com/dashboard/project/YOUR_PROJECT_REF/editor
(devem existir: `scrape_jobs`, `leads`, `messages`, `sends`, `settings`).

---

## Passo 2 — Dashboard local (T4)  ✅ testável já
```bash
cd web
cp ../.env.example .env     # e edite: mantenha só VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm install
npm run dev                 # abre em http://localhost:5173
```
As 4 abas devem carregar. (O contador de mapeamento só anda com o agente do Passo 4.)

---

## Passo 3 — Edge Functions (T2 + T3)
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# secrets das funções (Gemini + uazapi)
supabase secrets set \
  GEMINI_API_KEY="<sua_gemini_key>" \
  UAZAPI_BASE_URL="https://sua-instancia.uazapi.com" \
  UAZAPI_TOKEN="<seu_token_uazapi>"

# deploy das 4 funções
supabase functions deploy score-leads
supabase functions deploy generate-messages
supabase functions deploy enqueue-sends
supabase functions deploy process-send-queue
```
> `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente nas funções.

---

## Passo 4 — Agente local (T1)  ✅ testável já
```bash
cd agent
python -m venv .venv
.venv/Scripts/activate            # Windows  (Linux/Mac: source .venv/bin/activate)
pip install -e .
playwright install chromium
cp ../.env.example .env            # e edite: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
python main.py                     # liga o agente; deixe rodando
```
Agora, no dashboard → aba **Mapeamento** → **Começar Mapeamento**: o navegador abre e o
contador sobe ao vivo. 🎉

---

## Passo 5 — Reativar o cron (pg_cron chama as funções)
No [SQL Editor](https://supabase.com/dashboard/project/YOUR_PROJECT_REF/sql/new):
```sql
-- 1) secrets do Vault (substitua o service_role_key)
select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
```
```sql
-- 2) cole e rode TODO o conteúdo de supabase/migrations/0002_cron.sql
```
Confira: `select * from cron.job;` (devem aparecer `process-send-queue` e `score-and-generate`).

---

## Passo 6 — Go-live na Vercel (dashboard público)
```bash
npm i -g vercel
cd web
vercel            # primeira vez: linka o projeto
vercel --prod     # publica
```
No painel da Vercel, configure as env vars do projeto:
`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

---

## Fluxo completo depois de tudo no ar

```
[Começar Mapeamento] → agente raspa ~50 sem site (contador ao vivo)
   → cron (5min): score-leads pontua + generate-messages escreve 6/dia
   → aba Aprovação: você revê e clica [Aprovar e enviar]
   → enqueue-sends agenda (1 a cada 3 min)
   → cron (1min): process-send-queue dispara via WhatsApp respeitando o gap
   → aba Dashboard: funil, conversão por nicho, receita
```

---

## Checklist final
- [ ] Tabelas existem (Passo 1)
- [ ] `web/.env` preenchido, `npm run dev` abre (Passo 2)
- [ ] 4 funções deployadas + secrets setados (Passo 3)
- [ ] `agent/.env` preenchido, `python main.py` conecta (Passo 4)
- [ ] Mapeamento de teste roda e o contador sobe
- [ ] Vault secrets criados + `0002_cron.sql` reaplicada (Passo 5)
- [ ] `cron.job` mostra os 2 jobs
- [ ] (opcional) dashboard publicado na Vercel (Passo 6)

> Dica anti-ban: rode o scraper poucas vezes/semana (~50/vez) do seu IP residencial.
> Os envios já são limitados a 6/dia, 1 a cada 3 min — não aumente no começo.
