import { assert, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildScoringUserPrompt, buildMessageUserPrompt } from './prompts.ts';
import type { LeadRow } from './types.ts';

const lead: LeadRow = {
  id: 'lead-1',
  name: 'Clínica Bella',
  phone: '5585999999999',
  category_maps: 'Clínica de estética',
  niche: 'estética',
  niche_tier: 'quente',
  rating: 4.8,
  num_reviews: 340,
  has_instagram: true,
  score: 92,
  status: 'pontuado',
};

Deno.test('scoring prompt inclui dados do lead e flag de telefone', () => {
  const p = buildScoringUserPrompt([lead]);
  assertStringIncludes(p, 'lead-1');
  assertStringIncludes(p, 'Clínica Bella');
  assertStringIncludes(p, '"phone_valido": true');
  assertStringIncludes(p, '340');
});

Deno.test('message prompt inclui nicho, preço e assinatura', () => {
  const p = buildMessageUserPrompt([lead], 'Fortaleza - CE', 'Jeff | LPs', 'R$ 797 ou 10x');
  assertStringIncludes(p, 'estética');
  assertStringIncludes(p, 'Fortaleza - CE');
  assertStringIncludes(p, 'Jeff | LPs');
  assertStringIncludes(p, 'R$ 797 ou 10x');
});

Deno.test('telefone ausente vira phone_valido false', () => {
  const p = buildScoringUserPrompt([{ ...lead, phone: null }]);
  assert(p.includes('"phone_valido": false'));
});
