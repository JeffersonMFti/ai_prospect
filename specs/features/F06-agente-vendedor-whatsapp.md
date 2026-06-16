# F06 — Agente Vendedor por IA no WhatsApp + Follow-up

> Ativa junto com a conexão da uazapi (onda final). Captura os requisitos do usuário.

## Objetivo
Depois que a mensagem inicial sai, a IA assume a conversa **somente com os números que prospectamos**,
conduz a venda com técnicas de persuasão (ancoragem, prós de adquirir / contras de não adquirir) e
gerencia o follow-up de forma anti-ban.

## Regras de negócio

- **RN-01 (escopo da conversa):** a IA só responde a números que estão na tabela `leads` com status
  `enviado`/`respondeu` (ou seja, que NÓS contatamos). Mensagens de qualquer outro número são ignoradas.
- **RN-02 (gatilhos):** ao receber resposta, detectar intenção:
  - "EU QUERO" (ou variações de interesse alto) → IA entra em modo venda + oferece o esboço, status `respondeu`.
  - "ME EXPLICA MAIS" → IA explica benefícios/condições e conduz para o "EU QUERO".
  - Resposta negativa / pedido de parar → status `nao_perturbe`, encerra.
  - Outra resposta → IA interpreta e responde no tom consultivo, tentando avançar.
- **RN-03 (venda):** a IA usa as melhores técnicas: ancoragem (de R$ 1.297 por R$ 797, 10x sem juros),
  prova social do próprio negócio (avaliações), prós de TER LP (mais clientes, agendamento, Google) e
  contras de NÃO ter (perde cliente pro concorrente, depende só do Instagram). Sempre conduzindo ao fechamento.
- **RN-04 (follow-up):** quem não responde recebe **até 2 follow-ups** (configurável: `max_follow_ups`),
  espaçados por `follow_up_days` dias, em horário comercial (anti-ban). Após o último, se não houver
  "EU QUERO"/"ME EXPLICA MAIS", o lead **sai do ciclo** (status `descartado`) e o sistema segue com os próximos.
- **RN-05 (ritmo):** como são ~6 leads/dia, as mensagens podem ser bem espaçadas (intervalo configurável,
  maior que os 3 min mínimos) para ficar natural.
- **RN-06 (handoff):** quando o lead diz que quer fechar/pagar, a IA sinaliza no CRM (status `respondeu`
  + nota/anotação) para o Jefferson assumir o fechamento. A IA não processa pagamento.

## Componentes a construir (onda WhatsApp)
1. **Webhook uazapi** (`/webhook/set`) → recebe respostas. Endpoint local (sender/handler) ou Edge Function.
2. **Handler de conversa**: valida número (RN-01), detecta gatilho (RN-02), chama Gemini com o
   PROMPT DO VENDEDOR (abaixo) usando o histórico, responde via uazapi.
3. **Memória da conversa**: tabela `conversations` (lead_id, role, content, created_at) para a IA ter contexto.
4. **State machine de follow-up**: usa `agent/scheduling.py` (`should_follow_up`, janela de horário) — já pronto.
5. **Sender local** (já planejado): dispara inicial + follow-ups com throttle + janela de horário.

## PROMPT DO VENDEDOR (rascunho)
```
Você é Jefferson Monteiro (engenheiro de software) vendendo landing pages no WhatsApp.
Está conversando com um lead que demonstrou interesse. Seu objetivo é VENDER da melhor forma
possível, explicando tudo o que for necessário para o cliente entender o valor — mas SEMPRE de
forma EMPÁTICA e SEM PRESSIONAR. Você é um consultor que ajuda, não um vendedor insistente.

Postura:
- Empatia primeiro: entenda a realidade e a dor do negócio dele antes de oferecer.
- Explique com clareza e paciência (sem jargão técnico). Pode detalhar quanto for preciso para
  o cliente compreender os benefícios — explicar bem é parte de vender bem.
- Nunca empurre, nunca crie urgência falsa, nunca seja chato. Respeite o tempo do cliente.
- Se o cliente hesitar, acolha a objeção e esclareça com calma.

Técnicas (usar com naturalidade): ancoragem (normalmente R$ 1.297, hoje R$ 797 ou 10x sem juros),
prova social (as avaliações do próprio negócio dele), prós de TER a landing page (mais clientes,
agendamento direto, aparecer no Google, credibilidade), e os custos de NÃO ter (continuar invisível
no Google, depender só do Instagram, perder cliente para o concorrente que tem site) — sempre
apresentados como ajuda/consideração, não como ameaça.

Ofereça mostrar um esboço da página dele. Quando ele quiser fechar, diga que vai chamar o Jefferson
para finalizar. Responda curto e natural (é WhatsApp), uma ideia por mensagem, com um próximo passo gentil.

PROIBIDO usar emojis. Texto limpo, humano e profissional.
```

## Critérios de aceitação
- AC1: IA responde só a números prospectados; ignora desconhecidos.
- AC2: "EU QUERO" e "ME EXPLICA MAIS" disparam os fluxos corretos.
- AC3: follow-up respeita máximo (2), espaçamento e horário comercial; encerra quem não engaja.
- AC4: conversa tem memória (contexto entre mensagens).
- AC5: lead quente sinalizado no CRM para handoff humano.

## Pendências / decisões
- Detecção de intenção: começar simples (palavras-chave EU QUERO / ME EXPLICA MAIS) + Gemini para o resto.
- Onde roda o handler: local (junto do agente) é mais simples no MVP; Edge Function se quiser 24/7 sem PC ligado.
