import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn('[supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY ausentes. Configure web/.env');
}

// Fallback inócuo para ambiente de teste/build sem env (evita crash do createClient).
export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'anon-placeholder', {
  realtime: { params: { eventsPerSecond: 5 } },
});
