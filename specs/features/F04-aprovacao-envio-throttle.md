# F04 — Aprovação + Envio WhatsApp com Throttle (uazapi)

## Objetivo
Implementar o agendamento de envios ao aprovar (`enqueue-sends`) e o disparo controlado (`process-send-queue`) que envia **1 mensagem a cada 3 minutos** via uazapi.

## Escopo
**DENTRO:** `supabase/functions/enqueue-sends/`, `process-send-queue/`, `_shared/uazapi.ts`. Lógica de agendamento espaçado, cooldown de 3 min, disparo, atualização de status.
**FORA:** geração de mensagem (F03), UI de aprovação (F05 — só chama EF-3), webhook de resposta (futuro).

## Dependências
- F02 (`sends`, `messages`, `leads`, `settings`), F03 (mensagens existem).
- Contratos C2 (EF-3/EF-4), C4 (contrato uazapi), C3 (schema).
- Skill `uazapi-whatsapp` para detalhes da API na implementação.

## Comportamento detalhado
- **RN-01 (enqueue-sends / EF-3):** recebe `message_ids[]`. Para cada: marca `messages.approved=true`; `leads.status='aprovado'`; cria `sends` com `scheduled_at` = próximo slot livre.
- **RN-SEND-01 (agendamento):** `scheduled_at = max(now(), (maior scheduled_at entre sends 'agendado') + settings.send_interval_minutes)`. Aprovar 6 de uma vez → agenda em 0, +3, +6, +9, +12, +15 min.
- **RN-02 (process-send-queue / EF-4):** chamado pelo cron a cada 1 min:
  1. Se existe `sends status='enviado'` com `sent_at > now() - interval '3 min'` → aborta (cooldown ativo), retorna `{sent:0, reason:'cooldown'}`.
  2. Pega o `sends status='agendado' and scheduled_at<=now()` mais antigo.
  3. Valida telefone E.164. Monta payload uazapi (C4). Dispara.
  4. Sucesso → `status='enviado'`, `sent_at=now()`, `uazapi_response`; `leads.status='enviado'`.
  5. Falha → `status='falhou'`, `error_message`; lead permanece (permite reprocesso manual).
- **RN-03 (limite diário):** não enviar além de `settings.daily_send_limit` por dia (contar `sends` enviados hoje).
- **RN-04 (opt-out):** se `leads.status='nao_perturbe'`, cancelar sends pendentes (`status='cancelado'`).
- **RN-05 (idempotência):** uma mensagem aprovada gera no máx. 1 `sends`.

## Interface / Contrato
- Implementa **EF-3** e **EF-4** de [03-api-contracts.md](../03-api-contracts.md).
- `_shared/uazapi.ts` exporta `sendText(phone, text): Promise<UazapiResponse>` (usa `UAZAPI_BASE_URL`, `UAZAPI_TOKEN`).

## Critérios de aceitação
- AC1: Dado 6 mensagens aprovadas de uma vez, quando enfileiradas, então `sends` têm `scheduled_at` espaçados de 3 min (0,+3,...,+15).
- AC2: Dado um envio feito há 1 min, quando o cron roda, então **não** envia outro (cooldown) — retorna `cooldown`.
- AC3: Dado um `sends` agendado vencido e sem cooldown ativo, quando o cron roda, então dispara exatamente 1 e marca `enviado`.
- AC4: Dado uazapi retornando erro, quando dispara, então `status='falhou'` com `error_message` e não trava a fila.
- AC5: Dado `daily_send_limit=6` atingido, quando o cron roda, então não envia mais naquele dia.
- AC6: Dado lead `nao_perturbe`, quando há send pendente, então é `cancelado`.

## Testes obrigatórios
- Unit: cálculo de `scheduled_at` (RN-SEND-01) com fila vazia e com fila existente.
- Unit: detecção de cooldown (3 min) com casos de borda (exatamente 3 min).
- Unit: builder do payload uazapi + validação de telefone.
- Unit: contagem de limite diário.

## Riscos / notas
- Throttle por banco (não sleep) é resiliente a restart — manter assim.
- Webhook de resposta do uazapi (atualizar `responded`) fica para fase futura; deixar `// SPEC-GAP:` se tentar antecipar.
