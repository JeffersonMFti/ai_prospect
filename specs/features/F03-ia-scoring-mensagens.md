# F03 — IA: Scoring & Geração de Mensagens (Edge Functions + Gemini)

## Objetivo
Implementar as Edge Functions `score-leads` e `generate-messages` que usam Gemini 2.5 Flash para pontuar leads (quente→morno) e escrever mensagens de captação personalizadas com justificativa.

## Escopo
**DENTRO:** `supabase/functions/score-leads/`, `generate-messages/`, e `_shared/gemini.ts`, `_shared/types.ts`, `_shared/cors.ts`. Montagem de prompts (de [04-ai-prompts.md](../04-ai-prompts.md)), chamada Gemini com saída JSON, parse + validação Zod, atualização do banco.
**FORA:** envio (F04), schema (F02), UI (F05).

## Dependências
- F02 (tabelas `leads`, `messages`, `settings`).
- Contratos C1 (tipos), C2 (contratos EF-1/EF-2), C3 (schema).
- `04-ai-prompts.md` (prompts e schemas de saída).

## Comportamento detalhado
- **RN-01 (score-leads):** seleciona `leads status='novo'` (limit 50). Monta prompt de scoring. Chama Gemini (`response_mime_type=application/json`). Valida saída com Zod (`{results:[{lead_id,score,niche,niche_tier,reasoning_score}]}`). Atualiza cada lead → `status='pontuado'`.
- **RN-02 (generate-messages):** seleciona `leads status='pontuado' order by score desc limit settings.daily_send_limit`, excluindo os que já têm mensagem criada hoje. Monta prompt de mensagem com `settings.message_signature` e `price_text`. Chama Gemini. Valida. `insert messages`, `update leads status='pronto'`.
- **RN-03 (resiliência):** parse falhou → não muda status, loga payload bruto, retorna contagem 0 para aqueles. Retry com backoff (até 3x) em erro de rede/429.
- **RN-04 (custo):** logar tokens e custo estimado por chamada.
- **RN-05 (idempotência):** rodar 2x não duplica mensagens (checar existência de mensagem do dia por lead).
- **RN-06 (segurança):** `GEMINI_API_KEY` só via secret; nunca exposto.

## Interface / Contrato
- Implementa **EF-1** e **EF-2** de [03-api-contracts.md](../03-api-contracts.md) exatamente (input/output).
- `_shared/gemini.ts` exporta `callGemini<T>(systemPrompt, userPrompt, zodSchema): Promise<T>`.

## Critérios de aceitação
- AC1: Dado leads `novo`, quando `score-leads` roda, então cada um recebe `score` (0–100), `niche_tier` válido e vira `pontuado`.
- AC2: Dado lead de estética com 300 reviews e só Instagram, quando pontuado, então `niche_tier='quente'` e `score` alto (>70). (Teste com fixture/mocked Gemini.)
- AC3: Dado leads `pontuado`, quando `generate-messages` roda, então cria no máx. `daily_send_limit` mensagens com `text` e `justification` não vazios e leads viram `pronto`.
- AC4: Dado Gemini retornando JSON inválido, quando processado, então nenhum status muda e a função retorna contagem 0 sem crashar.
- AC5: Rodar `generate-messages` 2x no mesmo dia não duplica mensagens.

## Testes obrigatórios
- Unit: builder de prompt (inclui dados do lead + fatos de conversão).
- Unit: parser/validador da resposta Gemini (válido e inválido) com Gemini mockado.
- Unit: seleção dos "6 do dia" (ordenação por score, exclusão de já-gerados).

## Riscos / notas
- Forçar `response_schema` no Gemini quando suportado reduz parse quebrado.
- Mensagens não podem soar genéricas (regra de negócio crítica) — incluir asserts simples (cita nome/nicho).
