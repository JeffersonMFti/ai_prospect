// Contrato C1 — espelho dos tipos de domínio (igual a web/src/lib/types.ts).
export type LeadStatus =
  | 'novo' | 'pontuado' | 'pronto' | 'aprovado'
  | 'enviado' | 'respondeu' | 'fechou' | 'descartado' | 'nao_perturbe';
export type NicheTier = 'quente' | 'morno' | 'frio';
export type SendStatus = 'agendado' | 'enviado' | 'falhou' | 'cancelado';

export interface LeadRow {
  id: string;
  name: string;
  phone: string | null;
  category_maps: string | null;
  niche: string | null;
  niche_tier: NicheTier | null;
  rating: number | null;
  num_reviews: number | null;
  has_instagram: boolean;
  score: number | null;
  status: LeadStatus;
}

export interface ScoreResult {
  lead_id: string;
  score: number;
  niche: string;
  niche_tier: NicheTier;
  reasoning_score: string;
}

export interface MessageResult {
  lead_id: string;
  message: string;
  justification: string;
}
