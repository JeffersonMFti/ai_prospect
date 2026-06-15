# F05 — Dashboard Web (React + Vite + Vercel)

## Objetivo
Interface única para operar todo o sistema por cliques: iniciar mapeamento com progresso ao vivo, revisar/aprovar os 6 leads do dia (com justificativa da IA), acompanhar a fila de envio e ver métricas/funil.

## Escopo
**DENTRO:** app React (Vite+TS+Tailwind+shadcn), client Supabase, Realtime, páginas Mapeamento/Aprovação/Leads/Dashboard, hooks de dados, gráficos (Recharts).
**FORA:** lógica de IA/envio (Edge Functions), scraper. O front só lê dados e chama EFs/insere job.

## Dependências
- F02 (schema + RLS + Realtime), F03 (mensagens), F04 (EF-3 enqueue-sends).
- Contratos C1 (tipos), C2 (EFs), evento Realtime de `scrape_jobs`.

## Comportamento detalhado / Telas

### Tela 1 — Mapeamento
- Form: nicho + cidade (preenche de `settings.default_*`) + `target_count` (default 50).
- Botão **[Começar Mapeamento]** → `insert scrape_jobs (status='pending', ...)`.
- Após criar, **assina Realtime** na linha do job → mostra estado:
  - `pending`: "Aguardando o agente local..."
  - `running`: spinner + **"🔄 Mapeando... {found_count} empresas captadas"** (atualiza ao vivo).
  - `done`: "✅ {found_count} empresas captadas" + CTA "ver leads".
  - `error`: mensagem amigável + dica ("ligue o agente local" / "bloqueio, tente depois").
- **RN-01:** se `status` ficar `pending` por >30s, avisar "O agente local está ligado?".

### Tela 2 — Aprovação (os 6 do dia)
- Lista `leads status='pronto'` com `messages` (join), ordenados por `score desc`.
- Card por lead: nome, nicho, **🔥 nota**, telefone, mensagem (editável? — MVP: read-only), e bloco expansível **"Por que essa mensagem?"** com `justification` + `reasoning_score`.
- Botão **[Aprovar e enviar]** por card → chama **EF-3 enqueue-sends** com o `message_id`.
- Botão **[Descartar]** → `update leads status='descartado'`.
- Feedback: ao aprovar, card mostra "agendado para {hora}" e some da lista de pendentes.

### Tela 3 — Fila de envio
- Lista `sends` (agendado/enviado/falhou) com horário. Mostra **"Próximo envio em mm:ss"** (countdown até o próximo `scheduled_at`).
- Marca ✅ conforme enviados (Realtime/refetch).

### Tela 4 — Dashboard (métricas)
- Cards de topo: Hoje (prontos, enviados, próximo envio), Funil total (garimpados→enviados→responderam→fecharam), Conversão (taxa resposta, taxa fechamento vs meta 1,2%, R$ gerado).
- Gráficos: envios/dia (linha), conversão por nicho (barra), distribuição de nota (histograma), top nichos que respondem.
- **RN-02 (cálculos):**
  - taxa_resposta = responderam / enviados.
  - taxa_fechamento = fecharam / enviados.
  - R$ gerado = fecharam × 797.
  - Tratar divisão por zero (mostrar "—").

## Interface / Contrato
- Consome C1 (tipos), lê tabelas via `supabase-js` (RLS), chama EF-3.
- `web/src/lib/types.ts` espelha C1 (não diverge).

## Critérios de aceitação
- AC1: Dado clique em [Começar Mapeamento], quando o agente incrementa `found_count`, então o número sobe na tela sem refresh (Realtime).
- AC2: Dado leads `pronto`, quando abro Aprovação, então vejo os cards ordenados por nota com a justificativa expansível.
- AC3: Dado clique em [Aprovar e enviar], quando confirmo, então EF-3 é chamada e o card mostra o horário agendado.
- AC4: Dado dados de funil, quando abro o Dashboard, então as métricas e gráficos refletem o banco (com divisão-por-zero tratada).
- AC5: Estados loading/empty/error tratados em todas as telas.

## UI/UX
- Mobile-friendly, dark mode opcional (shadcn). Componentes acessíveis.
- Copy em PT-BR. Tom claro e direto.

## Testes obrigatórios
- Unit: hook de métricas (cálculos do funil, divisão por zero).
- Component: card de aprovação (render da justificativa, ação aprovar).
- Component: contador Realtime (mock de evento → número atualiza).

## Riscos / notas
- Nunca colocar `service_role` no front — só `anon`.
- Nunca chamar Gemini/uazapi do front — só via EF.
