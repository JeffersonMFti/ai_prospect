// Prompts do Gemini — fonte: specs/04-ai-prompts.md. Builders puros (testáveis).
import type { LeadRow } from './types.ts';

export const SCORING_SYSTEM = `Você é um analista de prospecção B2B especializado em vender landing pages (R$ 797).
Recebe dados de empresas SEM site, captadas no Google Maps.
Sua tarefa: dar uma NOTA de 0 a 100 (quão promissor é como cliente de landing page),
normalizar o nicho, classificar o niche_tier e explicar o porquê.

Use estes fatos de mercado:
- Nichos QUENTES (alta conversão em LP, dependem de captar cliente): estética, beleza,
  harmonização, odontologia, clínicas/saúde, advocacia, academias, serviços de alto ticket.
- Nichos MORNOS: restaurantes, salões, pet shops, cursos, imobiliárias pequenas.
- Nichos FRIOS: varejo de baixo ticket, decoração, comércio sem agendamento.
- Empresa com MUITAS avaliações + boa nota + só Instagram (sem site) = está vendendo,
  mas perde conversão -> lead muito quente.
- Sem telefone válido = quase inútil (nota baixa).

Responda SOMENTE em JSON: {"results":[{"lead_id","score","niche","niche_tier","reasoning_score"}]}.
niche_tier deve ser "quente", "morno" ou "frio". reasoning_score em português, 1-2 frases.`;

export const MESSAGE_SYSTEM = `Você é um copywriter de prospecção que vende landing pages para pequenas empresas via WhatsApp.
Produto: landing page profissional por R$ 797 (ou 10x sem juros).
Objetivo: mensagem curta, personalizada e consultiva que gere RESPOSTA (não soa spam).

Regras:
- Use os dados reais do lead (nome, nicho, nº de avaliações) — proibido template genérico.
- Conecte com a dor: usar só Instagram como site perde conversão (não tem CTA, é lento, não rankeia).
- Cite 1-2 benefícios de LP relevantes ao nicho. Fatos: vídeo +86%, mobile 54%,
  velocidade (cada 1s -4,4%), prova social +10-20%, CTA/form curto +120%.
- Tom humano e respeitoso. Máx ~4-5 linhas. 1 CTA. Inclua opção "responda SAIR".
- Personalização além do nome dobra a resposta — seja específico do negócio.

Responda SOMENTE em JSON: {"results":[{"lead_id","message","justification"}]}.`;

export function buildScoringUserPrompt(leads: LeadRow[]): string {
  const payload = leads.map((l) => ({
    lead_id: l.id,
    name: l.name,
    category_maps: l.category_maps,
    rating: l.rating,
    num_reviews: l.num_reviews,
    has_instagram: l.has_instagram,
    phone_valido: Boolean(l.phone),
  }));
  return `Pontue os leads abaixo. Devolva lead_id, score (0-100), niche, niche_tier, reasoning_score.\n\nLeads:\n${JSON.stringify(payload, null, 2)}`;
}

export function buildMessageUserPrompt(
  leads: LeadRow[],
  city: string,
  signature: string,
  priceText: string,
): string {
  const payload = leads.map((l) => ({
    lead_id: l.id,
    name: l.name,
    niche: l.niche,
    niche_tier: l.niche_tier,
    num_reviews: l.num_reviews,
    has_instagram: l.has_instagram,
    city,
  }));
  return `Escreva a mensagem de captação para cada lead. Devolva lead_id, message, justification.\n\nLeads:\n${JSON.stringify(payload, null, 2)}\nAssinatura: ${signature}\nPreço: ${priceText}`;
}
