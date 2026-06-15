// ============================================================================
// Tipos de domínio compartilhados — Contrato C1 (CONGELADO)
// Fonte: specs/03-api-contracts.md §Tipos compartilhados + specs/02-data-model.md
// Espelhado em supabase/functions/_shared/types.ts (T2).
// NÃO altere campos sem aprovar um novo contrato.
// ============================================================================

export type LeadStatus =
  | 'novo'
  | 'pontuado'
  | 'pronto'
  | 'aprovado'
  | 'enviado'
  | 'respondeu'
  | 'fechou'
  | 'descartado'
  | 'nao_perturbe';

export type NicheTier = 'quente' | 'morno' | 'frio';
export type JobStatus = 'pending' | 'running' | 'done' | 'error';
export type SendStatus = 'agendado' | 'enviado' | 'falhou' | 'cancelado';

export interface ScrapeJob {
  id: string;
  status: JobStatus;
  niche: string;
  city: string;
  target_count: number;
  found_count: number;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface Lead {
  id: string;
  job_id: string | null;
  name: string;
  phone: string | null;
  raw_phone: string | null;
  address: string | null;
  category_maps: string | null;
  niche: string | null;
  niche_tier: NicheTier | null;
  rating: number | null;
  num_reviews: number | null;
  has_instagram: boolean;
  instagram_url: string | null;
  maps_url: string | null;
  has_website: boolean;
  score: number | null;
  reasoning_score: string | null;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  lead_id: string;
  text: string;
  justification: string;
  model_used: string | null;
  approved: boolean;
  approved_at: string | null;
  created_at: string;
}

export interface Send {
  id: string;
  lead_id: string;
  message_id: string;
  scheduled_at: string;
  sent_at: string | null;
  status: SendStatus;
  uazapi_response: unknown | null;
  error_message: string | null;
  responded: boolean;
  responded_at: string | null;
  created_at: string;
}

export interface Settings {
  id: number;
  send_interval_minutes: number;
  daily_send_limit: number;
  default_niches: string[];
  default_city: string | null;
  message_signature: string;
  price_text: string;
  updated_at: string;
}
