# 04 — Lógica de IA & Prompts (Gemini 2.5 Flash)

> Spec transversal. Define **como a IA pontua** e **como escreve as mensagens**, embasada em pesquisa de mercado.
> Modelo: `gemini-2.5-flash`. Saída **sempre JSON** (response_mime_type `application/json`).

## Base de conhecimento (fatos de conversão usados pela IA)

Esses fatos vêm de pesquisa de mercado (jun/2026) e devem ser injetados no system prompt:

**Fatores que mais elevam conversão de uma landing page:**
- Vídeo na LP: **+86%** de conversão.
- Mobile: **54%** do tráfego — LP precisa ser mobile-first.
- Velocidade: cada **+1s** de carregamento = **-4,4%** conversão.
- Prova social / depoimentos: **+10–20%**.
- CTA claro + formulário curto (4 campos vs 11): **+120%**.

**Potencial de conversão em LP por nicho (niche_tier):**
- **quente:** estética, beleza, harmonização, odontologia, clínicas/saúde, advocacia, academias/fitness, serviços que dependem de captar cliente (alto ticket, decisão por confiança). Estética/cuidado pessoal lidera (~6,8%).
- **morno:** restaurantes, salões, pet shops, escolas/cursos, imobiliárias pequenas.
- **frio:** varejo de baixo ticket, decoração (~1,9%), comércio sem agendamento/lead.

**Cold outreach (benchmarks):**
- PME (<50 func.) responde mais: ~7% de taxa de resposta.
- WhatsApp: ~98% de abertura.
- **Personalização além do nome DOBRA a resposta (18% vs ~9%).** → mensagem genérica é proibida.

## Scoring — score 0–100 (usado por `score-leads`)

### Critérios (a IA pondera)
1. **niche_tier** (peso maior): quente=alto, morno=médio, frio=baixo.
2. **Sinal de negócio ativo mal resolvido online:** muitas avaliações + boa nota + **só Instagram, sem site** = lead quentíssimo.
3. **Alcançabilidade:** tem telefone válido.
4. **Potencial de ticket:** nicho que justifica investir R$ 797+ em captação.

### System prompt (scoring)
```
Você é um analista de prospecção B2B especializado em vender landing pages (R$ 797).
Recebe dados de empresas SEM site, captadas no Google Maps.
Sua tarefa: dar uma NOTA de 0 a 100 (quão promissor é como cliente de landing page),
normalizar o nicho, classificar o niche_tier e explicar o porquê.

Use estes fatos de mercado:
- Nichos QUENTES (alta conversão em LP, dependem de captar cliente): estética, beleza,
  harmonização, odontologia, clínicas/saúde, advocacia, academias, serviços de alto ticket.
- Nichos MORNOS: restaurantes, salões, pet shops, cursos, imobiliárias pequenas.
- Nichos FRIOS: varejo de baixo ticket, decoração, comércio sem agendamento.
- Empresa com MUITAS avaliações + boa nota + só Instagram (sem site) = está vendendo,
  mas perde conversão → lead muito quente.
- Sem telefone válido = quase inútil (nota baixa).

Responda SOMENTE em JSON no formato pedido. reasoning_score em português, 1-2 frases objetivas.
```

### User prompt (por lote)
```
Pontue os leads abaixo. Para cada um devolva: lead_id, score (0-100), niche, niche_tier
(quente|morno|frio), reasoning_score.

Leads:
[{ "lead_id", "name", "category_maps", "rating", "num_reviews", "has_instagram", "phone_valido": bool }, ...]
```

### Output (schema)
```json
{ "results": [
  { "lead_id": "uuid", "score": 92, "niche": "estética", "niche_tier": "quente",
    "reasoning_score": "Estética com 340 avaliações e só Instagram: negócio ativo perdendo conversão." }
]}
```

## Geração de mensagem (usado por `generate-messages`)

### Princípios da mensagem
- **Personalizar pelo nicho e pelos dados reais** (nome, nº de avaliações). Nada de template genérico.
- Tom **consultivo, não vendedor agressivo**. Curto (WhatsApp). 1 CTA claro (responder/conversar).
- Estrutura sugerida: (1) gancho específico do negócio → (2) dor de não ter LP / só Instagram →
  (3) 1–2 benefícios concretos relevantes ao nicho (ex.: agendamento, vídeo, prova social) →
  (4) oferta (R$ 797 ou 10x) leve → (5) CTA + opção de descadastro ("responda SAIR").
- Respeitar `settings.message_signature` e `settings.price_text`.
- Incluir **justification**: por que essa mensagem (nicho, sinais usados, fatores de conversão citados).

### System prompt (mensagem)
```
Você é um copywriter de prospecção que vende landing pages para pequenas empresas via WhatsApp.
Produto: landing page profissional por R$ 797 (ou 10x sem juros).
Objetivo: mensagem curta, personalizada e consultiva que gere RESPOSTA (não soa spam).

Regras:
- Use os dados reais do lead (nome, nicho, nº de avaliações) — proibido template genérico.
- Conecte com a dor: usar só Instagram como site perde conversão (não tem CTA, é lento, não rankeia).
- Cite 1-2 benefícios de LP relevantes ao nicho. Fatos que pode usar: vídeo +86%, mobile 54%,
  velocidade (cada 1s -4,4%), prova social +10-20%, CTA/form curto +120%.
- Tom humano e respeitoso. Máx ~4-5 linhas. 1 CTA. Inclua opção "responda SAIR".
- Personalização além do nome dobra a resposta — seja específico do negócio.
- Devolva também a justificativa do raciocínio (justification).

Responda SOMENTE em JSON.
```

### User prompt (por lote de até 6)
```
Escreva a mensagem de captação para cada lead. Devolva lead_id, message, justification.

Lead(s):
[{ "lead_id", "name", "niche", "niche_tier", "num_reviews", "has_instagram", "city" }, ...]
Assinatura: {settings.message_signature}
Preço: {settings.price_text}
```

### Output (schema)
```json
{ "results": [
  { "lead_id": "uuid",
    "message": "Oi Bella! Vi que vocês têm 340 avaliações no Maps — clientes amam vocês...",
    "justification": "Estética (tier quente, ~6,8% conv). Usei as 340 avaliações como prova de negócio ativo; citei agendamento e vídeo (+86%) por serem o que converte no nicho; tom consultivo p/ elevar resposta (18% vs 9%)." }
]}
```

## Uso de IA dentro do agente local (opcional, ADR-03)

- **Expandir queries:** dado `niche`+`city`, Gemini gera variações de busca do Maps
  (ex.: "estética Fortaleza", "harmonização facial Aldeota", "clínica de estética Meireles").
- **Limpeza/classificação rápida** do que foi raspado antes de inserir (descartar lixo, inferir nicho).
- Essas chamadas são opcionais no MVP; se cortar custo/tempo, o scraper usa o termo cru e a EF `score-leads` faz a classificação.

## Notas de implementação
- `_shared/gemini.ts`: wrapper com retry (exponential backoff) + parse seguro de JSON + validação Zod do schema de saída.
- Sempre passar `response_mime_type: "application/json"` e, se possível, `response_schema` para forçar o formato.
- Logar tokens/custo por chamada (observabilidade de custo).
- Se o parse falhar, **não** mudar o status do lead (deixa para o próximo ciclo) e logar o payload bruto.
